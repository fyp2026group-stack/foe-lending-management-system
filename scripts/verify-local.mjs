import pg from 'pg';
import assert from 'node:assert/strict';
const url=process.env.DATABASE_URL;
if(!url||new URL(url).hostname!=='127.0.0.1'||new URL(url).pathname!=='/lab_m2_test_identity')throw Error('Isolated database required');
const c=new pg.Client({connectionString:url});await c.connect();
try{
assert.equal((await c.query('SELECT current_user')).rows[0].current_user,'lab_runtime');
assert.equal(Number((await c.query('SELECT count(*) FROM lab.users')).rows[0].count),5);
assert.equal(Number((await c.query('SELECT count(DISTINCT role) FROM lab.user_roles')).rows[0].count),4);
for(const sql of ['CREATE TABLE lab.forbidden(id int)','DELETE FROM lab.audit','UPDATE lab.audit SET action=action','TRUNCATE lab.audit'])await assert.rejects(c.query(sql),e=>e.code==='42501');
console.log('Runtime verification passed: five fixtures, four roles, DDL/audit modification denied');
}finally{await c.end();}
