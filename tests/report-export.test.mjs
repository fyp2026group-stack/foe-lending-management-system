import assert from 'node:assert/strict';
import { test } from 'node:test';
import { strFromU8, unzipSync } from 'fflate';
import { csv, xlsx, xlsxColumn, safeSpreadsheetText } from '../src/lib/server/report-export.ts';

test('XLSX cell references support the full Excel column alphabet', () => {
  assert.equal(xlsxColumn(0), 'A');
  assert.equal(xlsxColumn(25), 'Z');
  assert.equal(xlsxColumn(26), 'AA');
  assert.equal(xlsxColumn(51), 'AZ');
  assert.equal(xlsxColumn(52), 'BA');
  assert.equal(xlsxColumn(701), 'ZZ');
  assert.equal(xlsxColumn(702), 'AAA');
  assert.equal(xlsxColumn(16383), 'XFD');
  assert.throws(() => xlsxColumn(-1), RangeError);
  assert.throws(() => xlsxColumn(16384), RangeError);
});

test('CSV neutralizes spreadsheet formulas and quotes multiline values', () => {
  const output = csv([{ name: '=1+1', warning: '+SUM(A1:A2)', notes: 'a,"b"\r\nc' }]);
  assert.ok(output.startsWith('\uFEFF'));
  assert.match(output, /"'=1\+1"/);
  assert.match(output, /"'\+SUM\(A1:A2\)"/);
  assert.match(output, /"a,""b""\r\nc"/);
  assert.equal(safeSpreadsheetText('  @cmd'), "'  @cmd");
});

test('XLSX exports valid multi-letter cell references and XML-safe literal strings', () => {
  const row = Object.fromEntries(Array.from({ length: 30 }, (_, i) => ['col' + i, 'value' + i]));
  row.col26 = '=SUM(A1:A2)';
  row.col29 = 'A\u0001<&>"\ud800';
  const archive = unzipSync(xlsx([row]));
  const sheet = strFromU8(archive['xl/worksheets/sheet1.xml']);
  assert.match(sheet, /<c r="Z1"/);
  assert.match(sheet, /<c r="AA1"/);
  assert.match(sheet, /<c r="AD2"/);
  assert.match(sheet, /&apos;=SUM\(A1:A2\)/);
  assert.match(sheet, /A&lt;&amp;&gt;&quot;�/);
  assert.doesNotMatch(sheet, /\u0001/);
  assert.doesNotMatch(sheet, /<f[\s>]/);
});
