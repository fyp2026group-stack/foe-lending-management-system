import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { availablePerEquipment,resolveBorrowingSources } from '../src/components/lending/request-source-selector.ts';

const origin = { itemId:'a', item:'Multimeter', kind:'RETURNABLE', uom:'unit',
  labId:'l1',lab:'Laboratory',locationId:'x1',location:'Store 1',
  availableQuantity:5,policy:'LECTURER' };
test('source resolution hides location selection yet preserves exact server source fields',()=>{
 const all=[origin,{...origin,labId:'l2',locationId:'x2',availableQuantity:12}];
 const people=[{id:'teacher',displayName:'Lecturer',labIds:['l2']}];
 const result=resolveBorrowingSources([{itemId:'a',quantity:9}],all,people,'student');
 assert.equal(result?.lines[0].labId,'l2');
 assert.equal(result?.lines[0].locationId,'x2');
 assert.equal(result?.lines[0].quantity,9);
 assert.deepEqual(result?.eligible.map(l=>l.id),['teacher']);
 assert.equal(availablePerEquipment(all,'a'),12);
 assert.equal(resolveBorrowingSources([{itemId:'a',quantity:21}],all,people,'student'),null);
});
test('lecturer eligibility selects compatible laboratories across multiple equipment types',()=>{
 const all=[origin,{...origin,itemId:'b',item:'Arduino',labId:'l3',locationId:'z3',availableQuantity:10,policy:'BOTH'},
  {...origin,itemId:'b',item:'Arduino',labId:'l1',locationId:'y1',availableQuantity:4,policy:'BOTH'}];
 const people=[{id:'teacher',displayName:'Lecturer',labIds:['l1']}];
 const r=resolveBorrowingSources([{itemId:'a',quantity:2},{itemId:'b',quantity:3}],all,people,'student');
 assert.equal(r?.lines[1].locationId,'y1');
 assert.equal(r?.eligible[0].id,'teacher');
});
test('request wizard has three human steps and no visible draft stage or stock location selectors',()=>{
 const s=readFileSync(new URL('../src/components/lending/request-builder.tsx',import.meta.url),'utf8');
 for(const mark of ['Choose equipment','Request details','Review & submit','Continue to details','Submit request','request-wizard-progress','resolveBorrowingSources','draftSavePayload','draftSubmitPayload','quantity']) {
   assert.ok(s.includes(mark),mark);
 }
 for(const bad of ['Save draft and review','Review saved draft','Collection location','Select location','Select laboratory']) assert.ok(!s.includes(bad),bad);
 assert.ok(!s.includes('name="locationId"'));
});
