import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID, createHash } from 'node:crypto';
import pg from 'pg';
import { configuration } from './m2-guard.mjs';

const digest = value => createHash('sha256').update(value).digest('hex');

test('whole-request approval blocks NONE items until the other item is approved', async () => {
  const db = new pg.Client({ connectionString: configuration(process.env).database });
  await db.connect();
  try {
    await db.query('BEGIN');
    const users = Object.fromEntries((await db.query(
      "SELECT id, split_part(email,'@',1) name FROM lab.users WHERE email IN('admin@example.invalid','student@example.invalid','lecturer@example.invalid','officer@example.invalid')"
    )).rows.map(row => [row.name,row.id]));
    assert.equal(Object.keys(users).length,4);
    const sessions = {};
    for (const [name,user] of Object.entries(users)) {
      const token=randomUUID(),csrf=randomUUID();
      sessions[name]={token,csrf};
      await db.query(
        "INSERT INTO lab.sessions(token_hash,user_id,csrf_hash,expires_at,last_seen_at) VALUES($1,$2,$3,clock_timestamp()+interval '1 hour',clock_timestamp())",
        [digest(token),user,digest(csrf)]
      );
    }
    const stock = (await db.query(
      "SELECT c.item_id,c.lab_id,c.location_id FROM lab.inv_cells c JOIN lab.inv_items i ON i.id=c.item_id WHERE i.name='Synthetic Multimeter' AND c.state='AVAILABLE' AND c.asset_id IS NULL LIMIT 1"
    )).rows[0];
    assert.ok(stock,'synthetic multimeter source required');
    const noApprovalItem=randomUUID();
    await db.query(
      "INSERT INTO lab.inv_items(id,category_id,name,kind,uom,active,version,specifications) SELECT $1,category_id,$2,kind,uom,true,0,specifications FROM lab.inv_items WHERE id=$3",
      [noApprovalItem, 'No-approval gate '+randomUUID(),stock.item_id]
    );
    await db.query('SELECT lab.inv_receive($1,$2)',[users.officer,{
      itemId:stock.item_id,labId:stock.lab_id,locationId:stock.location_id,
      quantity:4,provenance:'Approval-gate test '+randomUUID(),
    }]);
    await db.query('SELECT lab.inv_receive($1,$2)',[users.officer,{
      itemId:noApprovalItem,labId:stock.lab_id,locationId:stock.location_id,
      quantity:4,provenance:'No-approval gate test '+randomUUID(),
    }]);
    await db.query('SET LOCAL ROLE lab_runtime');
    const call=async(actor,op,p={})=>(await db.query(
      'SELECT lab.lending_call($1,$2,$3,$4) AS result',
      [sessions[actor].token,sessions[actor].csrf,op,p]
    )).rows[0].result;
    const write=(actor,op,p)=>call(actor,op,{commandId:randomUUID(),...p});
    const good=value=>{assert.ok(value && !value.status,JSON.stringify(value));return value};
    good(await write('admin','policies',{itemId:stock.item_id,policy:'LECTURER'}));
    good(await write('admin','policies',{itemId:noApprovalItem,policy:'NONE'}));

    const draft=good(await write('student','drafts',{
      purpose:'Mixed approval gate rollback-only',
      collectAt:new Date(Date.now()+3600000).toISOString(),
      returnAt:new Date(Date.now()+86400000).toISOString(),
      lecturerId:users.lecturer,
      lines:[
        { itemId:stock.item_id,labId:stock.lab_id,locationId:stock.location_id,quantity:1 },
        { itemId:noApprovalItem,labId:stock.lab_id,locationId:stock.location_id,quantity:1 },
      ],
    }));
    const submitted=good(await write('student','submit',{draftId:draft.id,expectedVersion:draft.version}));
    const read=async()=>good(await call('student','read_requests',{requestId:submitted.id})).items[0];
    let request=await read();
    assert.equal(request.lines.length,2);
    const approvalLine=request.lines.find(line=>line.policy==='LECTURER');
    const noApprovalLine=request.lines.find(line=>line.policy==='NONE');
    assert.ok(approvalLine&&noApprovalLine);
    assert.equal(approvalLine.stage,'LECTURER');
    assert.equal(noApprovalLine.stage,'APPROVED');
    assert.ok(request.lines.every(line=>line.reservedQuantity===0),
      'submit must not reserve NONE-policy line while any approval is pending');

    const premature=await write('student','reserve',{lineId:noApprovalLine.id});
    assert.ok(
      premature?.code === 'STATE_CONFLICT' || premature?.awaitingApprovals === true,
      'legacy explicit reserve cannot succeed before whole-order approval: '+JSON.stringify(premature)
    );
    assert.equal((await call('officer','read_ready',{requestId:submitted.id})).items.length,0);

    const decision=good(await write('lecturer','decisions',{
      lineId:approvalLine.id,expectedVersion:approvalLine.version,
      decision:'APPROVE',remarks:'Approved complete request',
    }));
    assert.equal(decision.stage,'APPROVED');
    request=await read();
    assert.equal(request.summary,'READY');
    assert.ok(request.lines.every(line=>line.reservedQuantity===1),
      'final approval must reserve both lines, not only the approved line');
    assert.equal((await call('officer','read_ready',{requestId:submitted.id})).items.length,2);
  } finally {
    await db.query('ROLLBACK');
    await db.end();
  }
});

test('per-item versioned HOD approval reserves all lines only after the last approval', async () => {
  const db=new pg.Client({connectionString:configuration(process.env).database});
  await db.connect();
  try {
    await db.query('BEGIN');
    const users=Object.fromEntries((await db.query(
      "SELECT id,split_part(email,'@',1) name FROM lab.users WHERE email IN('admin@example.invalid','student@example.invalid','lecturer@example.invalid','officer@example.invalid')"
    )).rows.map(row=>[row.name,row.id]));
    const sessions={};
    for(const [name,user] of Object.entries(users)){
      const token=randomUUID(),csrf=randomUUID();
      sessions[name]={token,csrf};
      await db.query(
        "INSERT INTO lab.sessions(token_hash,user_id,csrf_hash,expires_at,last_seen_at) VALUES($1,$2,$3,clock_timestamp()+interval '1 hour',clock_timestamp())",
        [digest(token),user,digest(csrf)]
      );
    }
    const stock=(await db.query(
      "SELECT c.item_id,c.lab_id,c.location_id FROM lab.inv_cells c JOIN lab.inv_items i ON i.id=c.item_id WHERE i.name='Synthetic Multimeter' AND c.state='AVAILABLE' AND c.asset_id IS NULL LIMIT 1"
    )).rows[0];
    assert.ok(stock);
    const locationId=randomUUID();
    await db.query('INSERT INTO lab.inv_locations(id,lab_id,name) VALUES($1,$2,$3)',
      [locationId,stock.lab_id,'Request-wide approval '+randomUUID()]);
    for(const loc of [stock.location_id,locationId]){
      await db.query('SELECT lab.inv_receive($1,$2)',[users.officer,{
        itemId:stock.item_id,labId:stock.lab_id,locationId:loc,
        quantity:4,provenance:'Gate test '+randomUUID(),
      }]);
    }
    await db.query('SET LOCAL ROLE lab_runtime');
    const call=async(actor,op,p={})=>(await db.query(
      'SELECT lab.lending_call($1,$2,$3,$4) AS result',
      [sessions[actor].token,sessions[actor].csrf,op,p]
    )).rows[0].result;
    const write=(actor,op,p)=>call(actor,op,{commandId:randomUUID(),...p});
    const good=v=>{assert.ok(v&&!v.status,JSON.stringify(v));return v};
    good(await write('admin','policies',{
      itemId:stock.item_id,policy:'BOTH',hodId:users.admin,
    }));
    const draft=good(await write('student','drafts',{
      purpose:'Whole order HOD gate rollback-only',
      lecturerId:users.lecturer,
      collectAt:new Date(Date.now()+3600000).toISOString(),
      returnAt:new Date(Date.now()+86400000).toISOString(),
      lines:[stock.location_id,locationId].map(loc=>({
        itemId:stock.item_id,labId:stock.lab_id,locationId:loc,quantity:1,
      })),
    }));
    const submitted=good(await write('student','submit',{
      draftId:draft.id,expectedVersion:draft.version,
    }));
    const read=async()=>good(await call('student','read_requests',{requestId:submitted.id})).items[0];
    let req=await read();
    assert.equal(req.lines.length,2);
    for(let index=0;index<2;index++){
      let line=req.lines[index];
      assert.equal(line.stage,'LECTURER',JSON.stringify(line));
      assert.equal(line.lecturerId,users.lecturer,JSON.stringify(line));
      good(await write('lecturer','decisions',{
        lineId:line.id,expectedVersion:line.version,decision:'APPROVE',
        remarks:'Lecturer '+index,
      }));
      req=await read();
      line=req.lines.find(x=>x.id===line.id);
      good(await write('admin','decisions',{
        lineId:line.id,expectedVersion:line.version,decision:'APPROVE',
        remarks:'HOD '+index,
      }));
      req=await read();
      if(index===0){
        assert.equal(req.lines.filter(x=>x.stage==='APPROVED').length,1);
        assert.ok(req.lines.every(x=>x.reservedQuantity===0));
        assert.equal((await call('officer','read_ready',{requestId:submitted.id})).items.length,0);
      }
    }
    assert.equal(req.summary,'READY');
    assert.ok(req.lines.every(x=>x.stage==='APPROVED'&&x.reservedQuantity===1));
    assert.equal((await call('officer','read_ready',{requestId:submitted.id})).items.length,2);
  } finally {
    await db.query('ROLLBACK');
    await db.end();
  }
});
