import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const file=(path)=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
test('inventory equipment detail uses an accessible shared shadcn dialog, not squeezed inline panel',()=>{
  const catalogue=file('src/components/inventory/catalogue-workspace.tsx');
  const sheet=file('src/components/ui/review-sheet.tsx');
  assert.ok(catalogue.includes('variant="equipment"'));
  assert.ok(catalogue.includes('<ReviewSheet'));
  assert.ok(!catalogue.includes('<ReviewPanel'));
  assert.ok(sheet.includes('<DialogContent'));
  assert.ok(sheet.includes('if (!locks.size) onOpenChange(value)'));
  assert.ok(sheet.includes('onEscapeKeyDown'));
  assert.ok(sheet.includes('review-sheet-footer'));
});
test('equipment detail retains real authorized stock, assets, movements and status data',()=>{
  const source=file('src/components/inventory/inventory.tsx');
  for(const contract of ['useInventoryLookup<Stock>','useInventoryLookup<Asset>','useInventoryLookup<Movement>',
    'row.quantity > 0', 'stockLabel(row.state)', 'item.active === false',
    "item.kind !== 'CONSUMABLE'",'entry.delta','equipment-movement-timeline']) {
    assert.ok(source.includes(contract),contract);
  }
  assert.ok(!source.includes("' ? ' + stockLabel(entry.state)"));
});
test('all shadcn operational dialogs share professional surface styling and reduced-motion behavior',()=>{
  const css=file('src/app/workspace.css');
  for(const contract of ['[data-slot="dialog-content"]','[data-slot="alert-dialog-content"]',
    '[data-slot="sheet-content"]','prefers-reduced-motion: reduce','equipment-detail-section']) {
    assert.ok(css.includes(contract),contract);
  }
});
