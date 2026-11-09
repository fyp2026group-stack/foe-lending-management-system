import {readFile,appendFile} from 'node:fs/promises';
import {randomBytes} from 'node:crypto';
import pg from 'pg';
const url=process.env.MIGRATION_DATABASE_URL;
if(!url||new URL(url).hostname!=='127.0.0.1'||new URL(url).pathname!=='/lab_m2_test_identity')throw Error('Dedicated local database required');
const path='.verification/m2.env';const config=await readFile(path,'utf8');
let secret=config.match(/^LOGIN_VERIFIER_SECRET=(.+)$/m)?.[1];
if(!secret){secret=randomBytes(32).toString('hex');await appendFile(path,'LOGIN_VERIFIER_SECRET='+secret+'\n');}
const c=new pg.Client({connectionString:url});await c.connect();
try{await c.query('INSERT INTO lab.verifier_secret(singleton,secret) VALUES(true,$1) ON CONFLICT(singleton) DO UPDATE SET secret=excluded.secret',[secret]);}finally{await c.end();}
