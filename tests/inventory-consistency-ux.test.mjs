import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const file=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
test('equipment locations show aggregated quantities, no raw internal versions',()=>{
 const s=file('src/components/inventory/inventory.tsx');
 for(const part of ['positive.reduce((map, row) =>','JSON.stringify([row.labId, row.locationId, row.state])','previous.quantity += row.quantity','balances.map((row) =>','assets.data.items.map((asset) =>'])assert.ok(s.includes(part),part);
 assert.ok(!s.includes('<th scope="col">Record version</th>'));
});
test('technical officer overview does not add incompatible unit types',()=>{
 const s=file('src/components/technical-officer/workspace.tsx');
 for(const part of ['label="Equipment types"','label="Returnable types"','label="Consumable types"','variant="stock"'])assert.ok(s.includes(part));
 assert.ok(!s.includes('rows.reduce((n, i) => n + (i[key] ?? 0), 0)'));
});
test('stock and import dialogs avoid stale misleading headings',()=>{
 const s=file('src/components/inventory/inventory.tsx');
 const o=file('src/components/technical-officer/workspace.tsx');
 const r=file('src/components/ui/review-sheet.tsx');
 assert.ok(s.includes('<summary>Required spreadsheet columns</summary>'));
 assert.ok(!s.includes('Receipt import workflow'));
 assert.ok(o.includes('Not configured — contact the HOD before issuing'));
 assert.ok(r.includes('INVENTORY / STOCK CONTROL'));
});
