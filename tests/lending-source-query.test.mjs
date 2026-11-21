import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseSourceQuery } from '../src/lib/server/services/lending-source-query.ts';

test('source query bounds and strict validation', () => {
  assert.equal(parseSourceQuery({}).limit, 100);
  for (const p of [{limit:0},{limit:101},{offset:-1},{offset:100001},{limit:'1e2'},
    {q:'x'.repeat(121)},{q:[]},{labId:'bad'},{categoryId:null},{itemId:''},
    {kind:'OTHER'},{policy:'OTHER'},{availableOnly:'yes'},{assetId:'hidden'}]) {
    assert.equal(parseSourceQuery(p), null, JSON.stringify(p));
  }
  assert.deepEqual(parseSourceQuery({limit:'1',offset:'100000',q:'  %_  ',availableOnly:'false'}),
    {limit:1,offset:100000,q:'%_',labId:null,categoryId:null,itemId:null,kind:null,policy:null});
});
