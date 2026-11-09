import pg from 'pg';
const url=process.env.MIGRATION_DATABASE_URL,password=process.env.LOCAL_RUNTIME_PASSWORD;
if(!url||!['localhost','127.0.0.1','[::1]'].includes(new URL(url).hostname)||!/^\/(lab_inventory|lab_m2_test_[a-z0-9_]+)$/.test(new URL(url).pathname)||!password||password.length<20)throw Error('Local database and runtime password20+ required');
const c=new pg.Client({connectionString:url,connectionTimeoutMillis:3000});await c.connect();
try{
await c.query('BEGIN');
if(!(await c.query("SELECT 1 FROM pg_roles WHERE rolname='lab_runtime'")).rows.length)await c.query('CREATE ROLE lab_runtime LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT');
await c.query("ALTER ROLE lab_runtime PASSWORD '"+password.replaceAll("'","''")+"'");
const db='"'+new URL(url).pathname.slice(1)+'"';
await c.query('REVOKE ALL ON DATABASE '+db+' FROM PUBLIC');
await c.query('GRANT CONNECT ON DATABASE '+db+' TO lab_runtime');
await c.query('REVOKE TEMPORARY ON DATABASE '+db+' FROM lab_runtime');
await c.query('COMMIT');
}catch(e){await c.query('ROLLBACK');throw e;}finally{await c.end();}
