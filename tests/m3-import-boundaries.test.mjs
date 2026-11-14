import { test } from 'node:test';
import assert from 'node:assert/strict';
import { zipSync, strToU8 } from 'fflate';
import { importRows } from '../src/lib/server/inventory-import.ts';
const id = '10000000-0000-4000-8000-000000000001';
const header = 'itemId,labId,locationId,quantity,provenance';
const row = (p = 'Synthetic') => `${id},${id},${id},1,${p}`;
test('CSV BOM, quoted unicode/newline and row bounds', async () => {
  const rows = await importRows(
    'CSV',
    `\uFEFF${header}\r\n${row('"Synthetic café,\nsecond line"')}`
  );
  assert.equal(rows[0].provenance, 'Synthetic café,\nsecond line');
  assert.equal(
    (
      await importRows(
        'CSV',
        header + '\n' + Array.from({ length: 100 }, (_, i) => row(`Synthetic${i}`)).join('\n')
      )
    ).length,
    100
  );
  await assert.rejects(
    importRows('CSV', header + '\n' + Array.from({ length: 101 }, () => row()).join('\n'))
  );
  await assert.rejects(importRows('CSV', header + '\n' + row('x'.repeat(301))));
  await assert.rejects(importRows('CSV', 'x'.repeat(700001)));
});
test('XLSX rejects external parts, UTF16 XML and invalid encodings', async () => {
  const encode = (parts) => Buffer.from(zipSync(parts)).toString('base64');
  // Standalone malicious packages must be rejected before workbook interpretation.
  for (const xml of [
    '<!DOCTYPE x [<!ENTITY e SYSTEM "file:///synthetic">]><x/>',
    '<f>1+1</f>',
    '<Relationship TargetMode="External" Target="https://example.invalid/file"/>',
  ])
    await assert.rejects(importRows('XLSX', encode({ 'xl/workbook.xml': strToU8(xml) })));
  const utf16 = Buffer.concat([
    Buffer.from([255, 254]),
    Buffer.from('<?xml version="1.0" encoding="UTF-16"?><!DOCTYPE x><x/>', 'utf16le'),
  ]);
  await assert.rejects(importRows('XLSX', encode({ 'xl/workbook.xml': utf16 })));
  await assert.rejects(importRows('XLSX', 'not base64!'));
  await assert.rejects(importRows('XLSX', encode({ '../escape.xml': strToU8('x') })));
  await assert.rejects(importRows('XLSX', encode({ 'xl/bomb.xml': strToU8('x'.repeat(1000001)) })));
});
