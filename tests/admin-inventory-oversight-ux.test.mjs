import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
test('HOD oversight removes duplicate header, tab and row action destinations',()=>{
  const s=read('src/components/inventory/catalogue-workspace.tsx');
  const a=read('src/components/hod-admin/workspace.tsx');
  assert.ok(s.includes("oversight ? ["));
  assert.ok(s.includes("{ value: 'catalogue', label: 'Equipment' }"));
  assert.ok(s.includes("{ value: 'definitions', label: 'Categories & locations' }"));
  assert.ok(s.includes('Add equipment type'));
  assert.ok(!s.includes('>Manage catalogue</Button>'));
  assert.ok(s.includes('admin && !oversight'));
  assert.ok(s.includes("{oversight ? 'View details' : 'Review'}"));
  assert.ok(s.includes("mode={oversight ? 'categoriesAndLocations' : 'all'}"));
  assert.ok(!a.includes('section="inventory"'));
  assert.ok(a.includes('<CatalogueWorkspace session={session} adjustmentsOnly />'));
});
test('HOD overview shows equipment-type counts, not misleading mixed unit totals',()=>{
  const s=read('src/components/inventory/catalogue-workspace.tsx');
  assert.ok(s.includes('Types needing attention'));
  assert.ok(s.includes('Returnable types'));
  assert.ok(s.includes('Consumable types'));
  assert.ok(s.includes('More filters'));
});
test('categories and locations management does not re-create item-level duplicate actions',()=>{
  const s=read('src/components/inventory/definitions.tsx');
  assert.ok(s.includes("mode?: 'all' | 'categoriesAndLocations'"));
  assert.ok(s.includes("mode === 'categoriesAndLocations' ? 'categories' : 'items'"));
  assert.ok(s.includes("Add {labels[resource]}"));
});
