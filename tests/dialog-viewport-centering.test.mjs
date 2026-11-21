import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const src=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
test('all dialog and alert modal content is laid out by a full-viewport centered portal, without double translation',()=>{
  for(const path of ['src/components/ui/dialog.tsx','src/components/ui/alert-dialog.tsx']){
    const s=src(path);
    assert.match(s,/pointer-events-none fixed inset-0 z-50 flex items-center justify-center/);
    assert.match(s,/pointer-events-auto relative z-50/);
    assert.ok(!s.includes('top-[50%]'));
    assert.ok(!s.includes('left-[50%]'));
    assert.ok(!s.includes('translate-x-[-50%]'));
    assert.ok(!s.includes('translate-y-[-50%]'));
  }
  const css=src('src/app/workspace.css');
  assert.ok(css.includes('position:relative;top:auto;left:auto;translate:none;transform:none'));
  assert.ok(!css.includes('position:fixed;top:50%;left:50%;translate:none;transform:translate(-50%,-50%)'));
  assert.ok(!css.includes('@keyframes foe-dialog-appear'));
});
test('details, receipt, import, corrections and confirmation all use the centralized dialog',()=>{
  const shared=src('src/components/ui/review-sheet.tsx');
  const officer=src('src/components/technical-officer/workspace.tsx');
  const confirm=src('src/components/ui/final-confirmation.tsx');
  const inventory=src('src/components/inventory/inventory.tsx');
  for(const fragment of ['inventory-receipt-dialog','equipment-detail-dialog','<DialogContent'])assert.ok(shared.includes(fragment));
  for(const fragment of ['<ReceiveItemsDialog','<ReviewSheet open={importOpen','<ReviewSheet open={stockOpen','open={Boolean(detail)}'])assert.ok(officer.includes(fragment));
  assert.ok(confirm.includes('<AlertDialogContent'));
  assert.ok(inventory.includes('<ReviewSheet'));
});
