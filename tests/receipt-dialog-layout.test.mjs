import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
test('receiving uses compact equipment picker and persistent footer without losing confirmation',()=>{
 const inv=read('src/components/inventory/inventory.tsx'),picker=read('src/components/inventory/lookups.tsx');
 const sheet=read('src/components/ui/review-sheet.tsx'),confirmed=read('src/components/ui/final-confirmation.tsx');
 for(const text of ['<ItemPicker name="receiptItem" label="Equipment" compact />','variant="receipt"','form="inventory-receipt-form"','formId="inventory-receipt-form" externalSubmit','path="receipts"'])assert.ok(inv.includes(text),text);
 assert.ok(picker.includes('if (compact) return'));
 assert.ok(confirmed.includes('<form id={formId} onSubmit={submit}'));
 assert.ok(confirmed.includes('{confirmation.dialog}'));
 assert.ok(sheet.includes('inventory-receipt-dialog'));
});
test('receipt payload uses original inventory permission and quantity contract',()=>{
 const inv=read('src/components/inventory/inventory.tsx');
 for(const text of ["itemId:d.get('receiptItem')","labId:d.get('receiptLab')","locationId:d.get('receiptLocation')","quantity:Number(d.get('receiptQuantity'))","provenance:d.get('provenance')"])assert.ok(inv.includes(text),text);
});
