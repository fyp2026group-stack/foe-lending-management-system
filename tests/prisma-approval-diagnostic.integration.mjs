import assert from 'node:assert/strict';
import pg from 'pg';
import { randomUUID, createHash } from 'node:crypto';
import { configuration } from './m2-guard.mjs';

const sha = value => createHash('sha256').update(value).digest('hex');
const db = new pg.Client({connectionString: configuration(process.env).database, connectionTimeoutMillis:3000});
await db.connect();
try {
 await db.query('BEGIN');
 const users = Object.fromEntries((await db.query(
   "SELECT id, split_part(email,'@',1) name FROM lab.users WHERE email IN('admin@example.invalid','student@example.invalid','lecturer@example.invalid')"
 )).rows.map(x=>[x.name,x.id]));
 const actors = {};
 for(const [role,id] of Object.entries(users)) {
   const token=randomUUID(), csrf=randomUUID();
   await db.query("INSERT INTO lab.sessions(token_hash,user_id,csrf_hash,expires_at,last_seen_at) VALUES($1,$2,$3,clock_timestamp()+interval '1 hour',clock_timestamp())",[sha(token),id,sha(csrf)]);
   actors[role]={token,csrf};
 }
 const source = (await db.query("SELECT c.item_id,c.lab_id,c.location_id FROM lab.inv_cells c JOIN lab.inv_items i ON i.id=c.item_id WHERE i.name='Synthetic Multimeter' AND c.state='AVAILABLE' LIMIT 1")).rows[0];
 assert.ok(source,'seed stock required');
 await db.query('SET LOCAL ROLE lab_runtime');
 const call = async (who,op,p)=> (await db.query('SELECT lab.lending_call($1,$2,$3,$4) result',[actors[who].token,actors[who].csrf,op,{commandId:randomUUID(),...p}])).rows[0].result;
 const policy = await call('admin','policies',{itemId:source.item_id,policy:'BOTH',hodId:users.admin});
 const request = await call('student','requests',{
   purpose:'approval diagnostic rollback-only',collectAt:new Date(Date.now()+3600000).toISOString(),returnAt:new Date(Date.now()+86400000).toISOString(),
   lecturerId:users.lecturer,lines:[{itemId:source.item_id,labId:source.lab_id,locationId:source.location_id,quantity:1}]
 });
 await db.query('RESET ROLE');
 const line = request.id ? (await db.query('SELECT id,stage FROM lab.lend_lines WHERE request_id=$1',[request.id])).rows[0] : null;
 await db.query('SET LOCAL ROLE lab_runtime');
 const decision = line ? await call('lecturer','decisions',{lineId:line.id,decision:'APPROVE',remarks:'diagnostic'}) : null;
 await db.query('RESET ROLE');
 assert.equal(policy.itemId,source.item_id);
 assert.ok(request.id,JSON.stringify(request));
 assert.equal(line?.stage,'LECTURER');
 assert.equal(decision?.stage,'HOD',JSON.stringify(decision));
 const hod = await call('admin','decisions',{lineId:line.id,decision:'APPROVE',remarks:'diagnostic HOD'});
 assert.equal(hod.stage,'APPROVED',JSON.stringify(hod));
} finally {
 await db.query('ROLLBACK');
 await db.end();
}
