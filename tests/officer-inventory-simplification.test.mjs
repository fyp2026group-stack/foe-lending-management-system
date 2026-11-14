import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const file=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
test('Technical Officer inventory has direct add items and Excel import actions',()=>{
const s=file('src/components/technical-officer/workspace.tsx');
assert.ok(s.includes('Add items'));
assert.ok(s.includes('Import Excel'));
assert.ok(!s.includes('<TabsTrigger value="imports">'));
assert.ok(s.includes('<ReceiveItemsDialog open={receiptOpen}'));
assert.ok(s.includes('<ImportPanel session={session} onSaved={refresh}/>'));
});
test('equipment dialogs are centred with independently scrolling content',()=>{
const s=file('src/app/workspace.css');
for(const part of ['transform:translate(-50%,-50%)','translate:none','overscroll-behavior:contain','animation:none !important'])assert.ok(s.includes(part));
});
test('quantity receipt and physical handover identification are distinct',()=>{
const a=file('src/components/inventory/inventory.tsx');
const b=file('src/components/technical-officer/workspace.tsx');
assert.ok(a.includes('path="receipts"'));
assert.ok(a.includes('Identifying a unit does not increase stock.'));
assert.ok(b.includes('assetId: asset'));
assert.ok(b.includes("serial: String(d.get('serial')).trim()"));
});