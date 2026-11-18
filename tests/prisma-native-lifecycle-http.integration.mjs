// Real HTTP regression for the native Prisma physical custody lifecycle.
// Never run against production: only the guarded disposable loopback database.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID, randomBytes } from 'node:crypto';
import pg from 'pg';
import { configuration } from './m2-guard.mjs';
import { hashPassword } from '../src/lib/server/password.mjs';

test('native HTTP: request-wide approvals through return and inspection', async () => {
  const cfg=configuration(process.env);
  assert.equal(cfg.origin,'http://127.0.0.1:3000');
  const db=new pg.Client({connectionString:cfg.database,connectionTimeoutMillis:3000});
  await db.connect();
  const run=randomUUID(),suffix=run.slice(0,8),password=randomBytes(24).toString('hex');
  const batch=randomUUID(),lab=randomUUID(),category=randomUUID(),item=randomUUID(),freeItem=randomUUID(),location=randomUUID();
  const roles=['admin','student','lecturer','officer'];
  const accounts=Object.fromEntries(roles.map(r=>[r,{
    id:randomUUID(),email:`prisma-${r}-${run}@example.invalid`,
  }]));
  try {
    assert.equal((await db.query('SELECT current_database() name')).rows[0].name,
      cfg.databaseName);
    await db.query('BEGIN');
    try{
      await db.query('INSERT INTO lab.batches(id,name) VALUES($1,$2)',[batch,'Native batch '+run]);
      await db.query('INSERT INTO lab.laboratories(id,name) VALUES($1,$2)',[lab,'Native lab '+run]);
      await db.query('INSERT INTO lab.inv_categories(id,name) VALUES($1,$2)',[category,'Native category '+run]);
      await db.query('INSERT INTO lab.inv_items(id,category_id,name,kind,uom) VALUES($1,$2,$3,$4,$5)',
        [item,category,'Native multimeter '+run,'RETURNABLE','unit']);
      await db.query('INSERT INTO lab.inv_items(id,category_id,name,kind,uom) VALUES($1,$2,$3,$4,$5)',
        [freeItem,category,'Native no-approval adaptor '+run,'RETURNABLE','unit']);
      await db.query('INSERT INTO lab.inv_locations(id,lab_id,name) VALUES($1,$2,$3)',
        [location,lab,'Native shelf '+run]);
      for(const role of roles){
        const a=accounts[role],type=role==='officer'?'TECHNICAL_OFFICER':role.toUpperCase();
        await db.query('INSERT INTO lab.users(id,email,display_name,password_hash,batch_id,registration_number) VALUES($1,$2,$3,$4,$5,$6)',
          [a.id,a.email,'Native '+role+' '+suffix,hashPassword(password),
            role==='student'?batch:null,role==='student'?'NATIVE-'+suffix:null]);
        await db.query('INSERT INTO lab.user_roles(user_id,role) VALUES($1,$2)',[a.id,type]);
        if(['lecturer','officer'].includes(role))
          await db.query('INSERT INTO lab.staff_labs(user_id,laboratory_id) VALUES($1,$2)',[a.id,lab]);
      }
      await db.query('INSERT INTO lab.lend_policies(item_id,policy,hod_id) VALUES($1,$2,$3)',
        [item,'BOTH',accounts.admin.id]);
      await db.query('INSERT INTO lab.lend_policies(item_id,policy,hod_id) VALUES($1,$2,$3)',
        [freeItem,'NONE',null]);
      await db.query('COMMIT');
    }catch(error){await db.query('ROLLBACK');throw error;}

    async function call(path,actor=null,body=null){
      const res=await fetch(cfg.origin+'/api/'+path,{
        method:body===null?'GET':'POST',redirect:'error',signal:AbortSignal.timeout(12000),
        headers:{
          ...(body!==null?{Origin:cfg.origin,'Content-Type':'application/json'}:{}),
          ...(actor?{Cookie:actor.cookie,'X-CSRF-Token':actor.csrf}:{}),
        },
        ...(body!==null?{body:JSON.stringify(body)}:{}),
      });
      const raw=await res.text();
      let data;
      try{data=JSON.parse(raw);}
      catch{throw Error('Non-JSON HTTP '+res.status+' on '+path+
        ': '+raw.replace(/<[^>]*>/g,' ').replace(/\\s+/g,' ').slice(0,250));}
      return {status:res.status,data,cookie:res.headers.get('set-cookie')};
    }
    const actors={};
    for(const role of roles){
      const result=await call('auth/login',null,{email:accounts[role].email,password});
      assert.equal(result.status,200,'login '+role+': '+JSON.stringify(result.data));
      actors[role]={cookie:result.cookie.split(';')[0],csrf:result.data.csrfToken};
    }
    const c=()=>randomUUID();
    const received=await call('inventory/receipts',actors.officer,{
      commandId:c(),itemId:item,labId:lab,locationId:location,
      quantity:1,provenance:'native-http-'+run,
    });
    assert.equal(received.status,200,'stock receipt '+JSON.stringify(received.data));
    const otherReceipt=await call('inventory/receipts',actors.officer,{
      commandId:c(),itemId:freeItem,labId:lab,locationId:location,
      quantity:1,provenance:'native-other-'+run,
    });
    assert.equal(otherReceipt.status,200,'other receipt '+JSON.stringify(otherReceipt.data));
    const request=await call('lending/requests',actors.student,{
      commandId:c(),purpose:'Native integration laboratory equipment',
      collectAt:new Date(Date.now()+3600_000).toISOString(),
      returnAt:new Date(Date.now()+3*86400_000).toISOString(),
      lecturerId:accounts.lecturer.id,
      lines:[
        {itemId:item,labId:lab,locationId:location,quantity:1},
        {itemId:freeItem,labId:lab,locationId:location,quantity:1},
      ],
    });
    assert.equal(request.status,200,'create request '+JSON.stringify(request.data));
    const requestId=request.data.id;
    const requestLines=(await db.query('SELECT id,item_id FROM lab.lend_lines WHERE request_id=$1',[requestId])).rows;
    assert.equal(requestLines.length,2);
    const line=requestLines.find(x=>x.item_id===item);
    const freeLine=requestLines.find(x=>x.item_id===freeItem);
    assert.ok(line?.id&&freeLine?.id);
    const early=await call('lending/reserve',actors.student,{commandId:c(),lineId:line.id});
    assert.equal(early.status,409,'request not approved: '+JSON.stringify(early.data));
    const earlyFree=await call('lending/reserve',actors.student,{commandId:c(),lineId:freeLine.id});
    assert.equal(earlyFree.status,409,
      'NONE-policy equipment must wait for approval of the entire request');
    const wrong=await call('lending/decisions',actors.student,{
      commandId:c(),lineId:line.id,decision:'APPROVE',remarks:'self',
    });
    assert.equal(wrong.status,403);
    const lect=await call('lending/decisions',actors.lecturer,{
      commandId:c(),lineId:line.id,decision:'APPROVE',remarks:'Verified',
    });
    assert.equal(lect.status,200,JSON.stringify(lect.data));
    assert.equal(lect.data.stage,'HOD');
    const hod=await call('lending/decisions',actors.admin,{
      commandId:c(),lineId:line.id,decision:'APPROVE',remarks:'Authorized',
    });
    assert.equal(hod.status,200,JSON.stringify(hod.data));
    assert.equal(hod.data.stage,'APPROVED');
    const freeReserved=await call('lending/reserve',actors.student,{
      commandId:c(),lineId:freeLine.id,
    });
    assert.equal(freeReserved.status,200,
      'NONE-policy equipment should reserve after all request approvals');
    const reserved=await call('lending/reserve',actors.student,{
      commandId:c(),lineId:line.id,
    });
    assert.equal(reserved.status,200,'reserve '+JSON.stringify(reserved.data));
    const issued=await call('lending/issues',actors.officer,{
      commandId:c(),allocationId:reserved.data.allocationId,quantity:1,
      serial:'NATIVE-'+suffix,
    });
    assert.equal(issued.status,200,'issue '+JSON.stringify(issued.data));
    assert.ok(issued.data.loanId);
    const extension=await call('lending/extensions',actors.student,{
      commandId:c(),loanId:issued.data.loanId,expectedVersion:0,
      proposedDueAt:new Date(Date.now()+5*86400_000).toISOString(),
      reason:'Additional engineering laboratory work',
    });
    assert.equal(extension.status,200,'extension '+JSON.stringify(extension.data));
    const extensionDecision=await call('lending/extension-decisions',actors.admin,{
      commandId:c(),extensionId:extension.data.extensionId,
      expectedVersion:0,decision:'APPROVE',remarks:'Authorized',
    });
    assert.equal(extensionDecision.status,200,'extension approval '+JSON.stringify(extensionDecision.data));
    const returnCommand=c(),returnBody={
      commandId:returnCommand,loanId:issued.data.loanId,
      quantity:1,condition:'Returned intact',
    };
    const returned=await call('lending/returns',actors.officer,returnBody);
    assert.equal(returned.status,200,'return '+JSON.stringify(returned.data));
    const replay=await call('lending/returns',actors.officer,returnBody);
    assert.equal(replay.status,200,'return replay');
    assert.deepEqual(replay.data,returned.data);
    const inspection=await call('lending/inspections',actors.officer,{
      commandId:c(),inspectionId:returned.data.inspectionId,expectedVersion:0,
      outcome:'CLEAR_AVAILABLE',condition:'Functionally sound',notes:'Inspection passed',
    });
    assert.equal(inspection.status,200,'inspection '+JSON.stringify(inspection.data));
    const position=await db.query(
      "SELECT state,sum(quantity)::int quantity FROM lab.inv_cells WHERE item_id=$1 GROUP BY state",
      [item]
    );
    assert.equal(position.rows.find(x=>x.state==='AVAILABLE')?.quantity,1,
      'equipment must return to available only after inspection');
    const ledger=await db.query(
      `SELECT m.id,coalesce(sum(e.delta),0)::int balance,count(e.*)::int entries
       FROM lab.inv_movements m LEFT JOIN lab.inv_entries e ON e.movement_id=m.id
       WHERE m.item_id=$1 GROUP BY m.id`,[item]
    );
    assert.ok(ledger.rows.length>=4);
    assert.ok(ledger.rows.every(x=>x.balance===0&&x.entries===2),
      'each physical movement must have balanced double-entry accounting');
  } finally {
    await db.end();
  }
});
