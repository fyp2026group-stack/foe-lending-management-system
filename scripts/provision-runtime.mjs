import pg from 'pg';

const url = process.env.MIGRATION_DATABASE_URL;
const ormPassword = process.env.LOCAL_ORM_PASSWORD;
const legacy = process.argv.includes('--legacy');
const legacyPassword = process.env.LOCAL_RUNTIME_PASSWORD;
const validHost = url && ['localhost','127.0.0.1','[::1]'].includes(new URL(url).hostname);
const validDatabase = url && /^\/(lab_inventory|lab_m2_test_[a-z0-9_]+)$/.test(new URL(url).pathname);
if (!validHost || !validDatabase ||
    !ormPassword || ormPassword.length < 20 ||
    (legacy && (!legacyPassword || legacyPassword.length < 20))) {
  throw Error('Dedicated local database and strong ORM password required');
}
const client = new pg.Client({ connectionString: url, connectionTimeoutMillis: 3000 });
await client.connect();
try {
  await client.query('BEGIN');
  const role = await client.query("SELECT 1 FROM pg_roles WHERE rolname='lab_orm'");
  if (!role.rows.length) {
    await client.query('CREATE ROLE lab_orm LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT');
  }
  await client.query("ALTER ROLE lab_orm LOGIN PASSWORD '" +
    ormPassword.replaceAll("'", "''") + "'");
  const db = '"' + new URL(url).pathname.slice(1) + '"';
  await client.query('REVOKE ALL ON DATABASE ' + db + ' FROM PUBLIC');
  await client.query('GRANT CONNECT ON DATABASE ' + db + ' TO lab_orm');
  await client.query('REVOKE TEMPORARY ON DATABASE ' + db + ' FROM lab_orm');

  if (legacy) {
    if (!(await client.query("SELECT 1 FROM pg_roles WHERE rolname='lab_runtime'")).rows.length) {
      await client.query(
        'CREATE ROLE lab_runtime LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT'
      );
    }
    await client.query("ALTER ROLE lab_runtime LOGIN PASSWORD '" +
      legacyPassword.replaceAll("'", "''") + "'");
    await client.query('GRANT CONNECT ON DATABASE ' + db + ' TO lab_runtime');
    await client.query('REVOKE TEMPORARY ON DATABASE ' + db + ' FROM lab_runtime');
  }
  await client.query('COMMIT');
  console.log(legacy ? 'Restricted ORM and legacy test accounts provisioned' :
    'Restricted native Prisma account provisioned (no legacy runtime login)');
} catch (error) {
  await client.query('ROLLBACK');
  throw error;
} finally {
  await client.end();
}
