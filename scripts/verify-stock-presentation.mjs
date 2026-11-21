// Read-only verification using existing synthetic accounts; no stock mutations.
import assert from 'node:assert/strict';
import { configuration } from '../tests/m2-guard.mjs';
const { origin } = configuration(process.env);
const password = process.env.SYNTHETIC_ADMIN_PASSWORD;
assert.ok(password);
for (const account of ['admin', 'officer']) {
  const login = await fetch(origin + '/api/auth/login', {method:'POST', redirect:'error', headers:{Origin:origin,'Content-Type':'application/json'}, body:JSON.stringify({email:account+'@example.invalid',password})});
  assert.equal(login.status,200,account+' login');
  const cookie = login.headers.get('set-cookie')?.split(';')[0];
  assert.ok(cookie);
  async function list(resource) {
    const items=[];
    for(let offset=0; offset<=10000; offset+=100) {
      const response=await fetch(origin+'/api/inventory/'+resource+'?limit=100&offset='+offset,{headers:{Cookie:cookie},redirect:'error'});
      assert.equal(response.status,200,account+' '+resource);
      const page=await response.json(); items.push(...page.items);
      if(page.items.length<100) return items;
    }
    throw Error('Incomplete stock list');
  }
  const items=await list('items'); const cells=await list('stock');
  const ids=new Set(items.filter(i=>i.kind==='RETURNABLE').map(i=>i.id));
  const totals=Object.fromEntries(['AVAILABLE','RESERVED','BORROWED','INSPECTION','MAINTENANCE'].map(state=>[state,cells.filter(c=>ids.has(c.item_id)&&c.state===state).reduce((sum,c)=>sum+c.quantity,0)]));
  console.log(JSON.stringify({account,itemCount:items.length,stockCells:cells.length,laboratoryCount:new Set(cells.map(c=>c.lab_id)).size,catalogueDisclosesReserved:items.every(i=>typeof i.reserved==='number'),returnableTotals:totals}));
}
