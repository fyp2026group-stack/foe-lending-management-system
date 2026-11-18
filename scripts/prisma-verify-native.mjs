import assert from 'node:assert/strict';
import pg from 'pg';

const migrationUrl=process.env.MIGRATION_DATABASE_URL;
const ormUrl=process.env.ORM_DATABASE_URL;
if(!migrationUrl||!ormUrl)throw Error('Both migration and restricted ORM connections are required');
const owner=new pg.Client({connectionString:migrationUrl});
const orm=new pg.Client({connectionString:ormUrl});
await owner.connect();
await orm.connect();
try{
  const ownerDb=(await owner.query('SELECT current_database() name')).rows[0].name;
  const ormDb=(await orm.query('SELECT current_database() name')).rows[0].name;
  assert.equal(ormDb,ownerDb,'Migration and ORM connections must target the same database');
  assert.equal((await orm.query('SELECT current_user name')).rows[0].name,
    'lab_orm','Runtime must use the dedicated restricted role');
  const applied=(await owner.query(`
    SELECT migration_name FROM lab._prisma_migrations
    WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL
  `)).rows.map(x=>x.migration_name);
  for(const required of [
    '0_init','20261119009000_native_integrity_guards',
    '20261119010000_native_complete_insert_defaults',
  ]) assert.ok(applied.includes(required),'Missing native Prisma migration: '+required);
  for(const table of [
    'lab.audit','lab.users','lab.sessions','lab.inv_cells','lab.inv_movements',
    'lab.inv_entries','lab.lend_lines','lab.lend_allocations','lab.lend_loans',
    'lab.lend_inspections','lab.lend_extensions',
  ]) {
    const found=(await owner.query('SELECT to_regclass($1) regclass',[table])).rows[0].regclass;
    assert.ok(found,'Missing required table '+table);
  }
  for(const [table,priv] of [
    ['lab.audit','UPDATE'],['lab.audit','DELETE'],
    ['lab.inv_movements','UPDATE'],['lab.inv_entries','DELETE'],
    ['lab.lend_decisions','UPDATE'],['lab.lend_returns','DELETE'],
    ['lab.users','DELETE'],['lab.sessions','DELETE'],
  ]) {
    const allowed=(await orm.query('SELECT has_table_privilege(current_user,$1,$2) allowed',
      [table,priv])).rows[0].allowed;
    assert.equal(allowed,false,'Excessive ORM table permission: '+table+' '+priv);
  }
  for(const [table,column] of [
    ['lab.sessions','token_hash'],['lab.sessions','csrf_hash'],
    ['lab.users','password_hash'],['lab.inv_cells','quantity'],
    ['lab.lend_lines','stage'],['lab.lend_loans','returned'],
  ]) {
    const allowed=(await orm.query('SELECT has_column_privilege(current_user,$1,$2,\'SELECT\') allowed',
      [table,column])).rows[0].allowed;
    assert.equal(allowed,true,'Missing required ORM column read: '+table+'.'+column);
  }
  const triggerRows=(await owner.query(`
    SELECT c.relname,t.tgname FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid
    JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='lab' AND NOT t.tgisinternal
  `)).rows;
  for(const [table,trigger] of [
    ['inv_entries','inv_balanced'],['inv_cells','inv_cell_reconcile'],
    ['lend_allocations','lend_guard_allocation_approved'],
    ['lend_loans','lend_guard_handover_approved'],
  ])assert.ok(triggerRows.some(row=>row.relname===table&&row.tgname===trigger),
    'Missing database integrity trigger: '+table+'/'+trigger);
  console.log('Prisma-native schema, migrations, ORM role and protected ledger guards verified');
}finally{
  await Promise.all([owner.end(),orm.end()]);
}
