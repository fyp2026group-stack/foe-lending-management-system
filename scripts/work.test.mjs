import {test} from 'node:test';
import assert from 'node:assert/strict';
import {derive,boundedBody} from '../src/lib/server/work.ts';
test('stream cap rejects chunked oversized input and accepts bounded UTF8',async()=>{
const stream=new ReadableStream({start(c){c.enqueue(new Uint8Array(9000));c.enqueue(new Uint8Array(9000));c.close();}});
await assert.rejects(boundedBody(new Request('http://localhost',{method:'POST',body:stream,duplex:'half'})));
assert.equal(await boundedBody(new Request('http://localhost',{method:'POST',body:'{"ok":true}'})),'{"ok":true}');
});
test('async password work rejects overflow without queue growth',async()=>{
const jobs=[derive('synthetic-password','salt-one'),derive('synthetic-password','salt-two')];
await assert.rejects(derive('synthetic-password','salt-three'),/PASSWORD_WORK_BUSY/);
assert.equal((await Promise.all(jobs)).length,2);
});
