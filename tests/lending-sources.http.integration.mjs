// Read-only catalogue checks; login only writes normal session activity.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { configuration } from './m2-guard.mjs';

test('bounded sources, exact page totals, filters and privacy for all four roles', async () => {
  const { origin } = configuration(process.env);
  assert.ok(process.env.SYNTHETIC_ADMIN_PASSWORD);
  for (const account of ['admin','student','lecturer','officer']) {
    const login = await fetch(origin+'/api/auth/login', {method:'POST',redirect:'error',
      headers:{Origin:origin,'Content-Type':'application/json'}, signal:AbortSignal.timeout(15000),
      body:JSON.stringify({email:account+'@example.invalid',password:process.env.SYNTHETIC_ADMIN_PASSWORD})});
    assert.equal(login.status,200,account+' login');
    const cookie=login.headers.get('set-cookie')?.split(';')[0];
    assert.ok(cookie); await login.arrayBuffer();
    const read=async (query, status=200) => {
      const r=await fetch(origin+'/api/lending/sources?'+new URLSearchParams(query),{
        headers:{Cookie:cookie},redirect:'error',signal:AbortSignal.timeout(15000)});
      assert.equal(r.status,status,account+' source response'); return r.json();
    };
    const first=await read({limit:1});
    assert.ok(Number.isSafeInteger(first.total)); assert.ok(first.items.length<=1);
    const beyond=await read({limit:1,offset:100000});
    assert.equal(beyond.total,first.total); assert.deepEqual(beyond.items,[]);
    const second=await read({limit:1,offset:1});
    assert.equal(second.total,first.total);
    const all=await read({limit:100});
    assert.equal(all.items.length,Math.min(100,all.total));
    assert.deepEqual(first.items,all.items.slice(0,1));
    assert.deepEqual(second.items,all.items.slice(1,2));
    for (const s of all.items) {
      assert.ok(s.availableQuantity>0);
      assert.deepEqual(Object.keys(s).sort(), ['itemId','item','kind','uom','labId','lab','locationId','location','availableQuantity','policy','categoryId','category','specifications'].sort());
    }
    if (first.items.length) {
      const s=first.items[0];
      for (const [field,value] of Object.entries({q:s.itemId,categoryId:s.categoryId,labId:s.labId,itemId:s.itemId,kind:s.kind,policy:s.policy})) {
        const filtered=await read({[field]:value,limit:100});
        assert.ok(filtered.total>=1,field);
        if(field!=='q') assert.ok(filtered.items.every(x=>x[field]===value),field);
      }
    }
    assert.deepEqual((await read({q:'nonexistent-catalogue-source-918270'})).items,[]);
    assert.deepEqual(await read({availableOnly:'false',limit:1}),first);
    for(const query of [{limit:101},{offset:-1},{q:'x'.repeat(121)},{categoryId:'bad'},{kind:'BAD'},{policy:'BAD'},{availableOnly:'bad'}])
      assert.equal((await read(query,422)).code,'INVALID');
    console.log(account+': source contract passed; total='+first.total);
  }
});
