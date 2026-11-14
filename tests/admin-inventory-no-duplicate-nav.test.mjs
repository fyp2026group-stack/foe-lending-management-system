import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const code=path=>readFileSync(new URL('../'+path, import.meta.url),'utf8');

test('HOD inventory oversight has one primary action and only two section tabs',()=>{
  const cat=code('src/components/inventory/catalogue-workspace.tsx');
  const admin=code('src/components/hod-admin/workspace.tsx');
  assert.ok(admin.includes('<CatalogueWorkspace session={session} oversight />'));
  assert.ok(!admin.includes('section="inventory"'));
  assert.ok(cat.includes("{ value: 'catalogue', label: 'Equipment' }"));
  assert.ok(cat.includes("{ value: 'definitions', label: 'Categories & locations' }"));
  assert.ok(cat.includes('Add equipment type'));
  assert.ok(!cat.includes('>Manage catalogue</Button>'));
  assert.ok(cat.includes("mode={oversight ? 'categoriesAndLocations' : 'all'}"));
});

test('Stock Adjustments remains a working separate destination without inventory tab controls',()=>{
  const admin=code('src/components/hod-admin/workspace.tsx');
  const cat=code('src/components/inventory/catalogue-workspace.tsx');
  const ops=code('src/components/inventory/inventory.tsx');
  assert.ok(admin.includes('<CatalogueWorkspace session={session} adjustmentsOnly />'));
  assert.ok(cat.includes('if (adjustmentsOnly)'));
  assert.ok(cat.includes('title="Stock Adjustments"'));
  assert.ok(cat.includes('reviewOnly'));
  assert.ok(ops.includes('{!reviewOnly && ('));
  assert.ok(ops.includes('title="Approve stock adjustment"'));
  assert.ok(ops.includes('row.proposer === session.user.id'));
});
