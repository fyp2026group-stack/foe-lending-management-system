// Disposable native HTTP QA runner. Never connects to an existing database.
import { spawn, spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { mkdirSync, writeFileSync, openSync, closeSync } from 'node:fs';
import pg from 'pg';
const name='lab-qa-'+Date.now(), database='lab_m2_test_'+Date.now();
const password=randomBytes(24).toString('hex'), ormPassword=randomBytes(24).toString('hex');
const dir='.verification/'+name; mkdirSync(dir,{recursive:true});
const records=[];
let server,created=false;
function run(command,args,env=process.env){
  const result=spawnSync(command,args,{env,encoding:'utf8',timeout:600000,shell:false});
  const output=(result.stdout??'')+(result.stderr??'');
  writeFileSync(dir+'/'+records.length+'.log',output.replaceAll(password,'[redacted]').replaceAll(ormPassword,'[redacted]'));
  records.push({command:[command,...args].join(' ').replaceAll(password,'[redacted]'),exit:result.status});
  console.log(command,args[0], 'exit',result.status);
  if(result.status!==0)throw Error(output.replaceAll(password,'[redacted]').replaceAll(ormPassword,'[redacted]'));
  return output.trim();
}
try{
  run('docker',['run','--detach','--name',name,'--publish','127.0.0.1::5432','--env','POSTGRES_DB='+database,'--env','POSTGRES_PASSWORD='+password,'--tmpfs','/var/lib/postgresql/data','postgres:16']); created=true;
  const port=run('docker',['port',name,'5432/tcp']).split(':').at(-1);
  const url=`postgresql://postgres:${password}@127.0.0.1:${port}/${database}`;
  const env={...process.env,DATABASE_URL:url+'?schema=lab',MIGRATION_DATABASE_URL:url+'?schema=lab',ORM_DATABASE_URL:`postgresql://lab_orm:${ormPassword}@127.0.0.1:${port}/${database}?schema=lab`,APP_ORIGIN:'http://127.0.0.1:3000',M2_TEST_APP_ORIGIN:'http://127.0.0.1:3000',M2_TEST_DATABASE_URL:url,M2_TEST_ENABLE:'synthetic-only',NEXT_TELEMETRY_DISABLED:'1'};
  // Retry bounded connection attempts while this newly created PostgreSQL initializes.
  for(let i=0;i<30;i++){
    const db=new pg.Client({connectionString:url,connectionTimeoutMillis:1000});
    try{await db.connect();await db.end();break;}catch(error){await db.end().catch(()=>{});if(i===29)throw error;await new Promise(r=>setTimeout(r,1000));}
  }
  run(process.execPath,['node_modules/prisma/build/index.js','migrate','deploy','--config','prisma7.config.ts'],env);
  run(process.execPath,['node_modules/prisma/build/index.js','migrate','status','--config','prisma7.config.ts'],env);
  const db=new pg.Client({connectionString:url});await db.connect();
  await db.query(`ALTER ROLE lab_orm LOGIN PASSWORD '${ormPassword}'`);
  writeFileSync(dir+'/roles.json',JSON.stringify((await db.query("SELECT rolname,rolsuper,rolcreatedb,rolcreaterole FROM pg_roles WHERE rolname IN ('lab_orm','lab_runtime')")).rows,null,2));
  await db.end();
  run(process.execPath,['node_modules/prisma/build/index.js','generate','--config','prisma7.config.ts'],env);
  run(process.execPath,['node_modules/next/dist/bin/next','build'],env);
  const fd=openSync(dir+'/server.log','w');
  server=spawn(process.execPath,['node_modules/next/dist/bin/next','start','--hostname','127.0.0.1','--port','3000'],{env,stdio:['ignore',fd,fd]});closeSync(fd);
  for(let i=0;i<45;i++){
    if(server.exitCode!==null)throw Error('Owned HTTP server exited before readiness');
    try{const res=await fetch(env.APP_ORIGIN+'/login');if(res.ok)break;}catch{}
    if(i===44)throw Error('HTTP server readiness failed');await new Promise(r=>setTimeout(r,1000));
  }
  run(process.execPath,['--test','--test-concurrency=1','tests/prisma-native-lifecycle-http.integration.mjs','tests/prisma-native-admin-report-http.integration.mjs','tests/prisma-native-reuse-http.integration.mjs'],env);
}catch(error){console.error(error.message);process.exitCode=1;}
finally{
  if(server)server.kill();
  if(created)run('docker',['stop',name]);
  writeFileSync(dir+'/commands.json',JSON.stringify(records,null,2));
  console.log('Evidence:',dir);
}
