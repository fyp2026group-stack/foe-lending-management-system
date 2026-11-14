import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const get=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
test('officer uses Equipment + Inventory history, with stock control context action',()=>{
 const s=get('src/components/technical-officer/workspace.tsx');
 assert.ok(s.includes('Manage units & corrections'));
 assert.ok(s.includes('<OfficerStockActions'));
 assert.ok(!s.includes('<TabsTrigger value="stock">'));
 assert.ok(!s.includes('Common stock operations'));
 assert.ok(!s.includes('Select an available stock cell'));
});
test('stock control preserves protected version checks and independent corrections',()=>{
 const s=get('src/components/inventory/officer-stock-actions.tsx');
 assert.ok(s.includes('expectedVersion:selected.version'));
 assert.ok(s.includes('path="adjustments"'));
 assert.ok(s.includes('path="assets"'));
 assert.ok(s.includes("row.id"));
 assert.ok(!s.includes('row.version}</TableCell>'));
 assert.ok(s.includes('The system generates an internal ID automatically.'));
});
