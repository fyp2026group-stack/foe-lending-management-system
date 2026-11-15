import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const src=readFileSync(new URL('../src/components/technical-officer/workspace.tsx',import.meta.url),'utf8');
test('officer inventory history only shows inventory movements, not lending or session audit events',()=>{
 const section=src.slice(src.indexOf('function OperationsActivity('));
 assert.ok(section.includes("useInventoryLookup<Movement>('movements', revision)"));
 assert.ok(section.includes("title=\"Inventory history\""));
 assert.ok(!section.includes("useLendingChoices<HistoryEvent>('history'"));
 assert.ok(!section.includes("operationalEvents("));
 assert.ok(section.includes('row.entries.map('));
 assert.ok(section.includes('<summary>View changes</summary>'));
});
