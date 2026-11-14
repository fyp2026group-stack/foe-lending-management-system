import assert from 'node:assert/strict';
import { zipSync, strToU8 } from 'fflate';
import { importRows, importIssues } from '../src/lib/server/inventory-import.ts';
const id = '10000000-0000-4000-8000-000000000001';
const csv =
  'itemId,labId,locationId,quantity,provenance\r\n' +
  [id, id, id, 2, '"Receipt, quoted"'].join(',');
assert.equal((await importRows('CSV', csv))[0].provenance, 'Receipt, quoted');
await assert.rejects(importRows('CSV', csv.replace(',2,', ',1.5,')));
try {
  await importRows('CSV', csv.replace(',2,', ',1.5,'));
  assert.fail('Invalid quantity accepted');
} catch (error) {
  assert(
    importIssues(error).some(
      (x) => x.row === 2 && x.column === 'quantity' && x.code === 'POSITIVE_INTEGER_REQUIRED'
    )
  );
}
await assert.rejects(importRows('CSV', 'wrong,headers\n1,2'));
const strings = ['itemId', 'labId', 'locationId', 'quantity', 'provenance', id, 'Receipt XLSX'];
const parts = {
  '[Content_Types].xml':
    '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="xml" ContentType="application/xml"/></Types>',
  'xl/workbook.xml':
    '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Stock" sheetId="1" r:id="rId1"/></sheets></workbook>',
  'xl/_rels/workbook.xml.rels':
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>',
  'xl/sharedStrings.xml':
    '<sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
    strings.map((x) => '<si><t>' + x + '</t></si>').join('') +
    '</sst>',
  'xl/worksheets/sheet1.xml':
    '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData><row r="1">' +
    ['A', 'B', 'C', 'D', 'E']
      .map((x, i) => '<c r="' + x + '1" t="s"><v>' + i + '</v></c>')
      .join('') +
    '</row><row r="2">' +
    ['A', 'B', 'C'].map((x) => '<c r="' + x + '2" t="s"><v>5</v></c>').join('') +
    '<c r="D2"><v>2</v></c><c r="E2" t="s"><v>6</v></c></row></sheetData></worksheet>',
};
const encode = (p) =>
  Buffer.from(
    zipSync(
      Object.fromEntries(
        Object.entries(p).map(([k, v]) => [k, typeof v === 'string' ? strToU8(v) : v])
      )
    )
  ).toString('base64');
assert.equal((await importRows('XLSX', encode(parts)))[0].quantity, 2);
const sheet = parts['xl/worksheets/sheet1.xml'];
const formulaSheet = sheet.replace('<v>2</v>', '<f>1+1</f><v>2</v>');
const utf16 = (xml) => Buffer.concat([Buffer.from([0xff, 0xfe]), Buffer.from(xml, 'utf16le')]);
const utf32 = (xml) => {
  const bytes = Buffer.alloc(xml.length * 4 + 4);
  bytes.writeUInt32LE(0xfeff, 0);
  for (let i = 0; i < xml.length; i++) bytes.writeUInt32LE(xml.charCodeAt(i), i * 4 + 4);
  return bytes;
};
for (const xml of [
  utf16(formulaSheet),
  utf32(formulaSheet),
  utf16('<!DOCTYPE worksheet [<!ENTITY x "forbidden">]>' + sheet),
  Buffer.from('<?xml version="1.0" encoding="UTF-16"?>' + sheet),
  Buffer.concat([Buffer.from([0xc3, 0x28]), Buffer.from(sheet)]),
]) {
  await assert.rejects(
    importRows('XLSX', encode({ ...parts, 'xl/worksheets/sheet1.xml': xml })),
    /XML_ENCODING/
  );
}
assert.equal(
  (
    await importRows(
      'XLSX',
      encode({
        ...parts,
        'xl/worksheets/sheet1.xml': '\uFEFF<?xml version="1.0" encoding="UTF-8"?>' + sheet,
      })
    )
  )[0].quantity,
  2
);
for (const part of [
  'xl/externalLinks/externalLink1.xml',
  'xl/vbaProject.bin',
  'xl/embeddings/oleObject1.bin',
  'xl/comments1.xml',
  'unexpected.xml',
])
  await assert.rejects(
    importRows('XLSX', encode({ ...parts, [part]: 'unsupported' })),
    /UNSUPPORTED_PART/
  );
await assert.rejects(
  importRows(
    'XLSX',
    encode({
      ...parts,
      '[Content_Types].xml': parts['[Content_Types].xml'].replace(
        'application/xml',
        'application/x-unexpected'
      ),
    })
  ),
  /UNSUPPORTED_PART/
);
await assert.rejects(
  importRows(
    'XLSX',
    encode({
      ...parts,
      'xl/_rels/workbook.xml.rels': parts['xl/_rels/workbook.xml.rels'].replace(
        'Target="worksheets/sheet1.xml"',
        'Target="https://example.invalid/sheet.xml" TargetMode="External"'
      ),
    })
  ),
  /REMOTE_RELATIONSHIP/
);
await assert.rejects(
  importRows(
    'XLSX',
    encode({
      ...parts,
      'xl/_rels/workbook.xml.rels': parts['xl/_rels/workbook.xml.rels'].replace(
        'Target="worksheets/sheet1.xml"',
        'Target="http&#58;//example.invalid/sheet.xml"'
      ),
    })
  ),
  /REMOTE_RELATIONSHIP/
);
await assert.rejects(
  importRows(
    'XLSX',
    encode({
      ...parts,
      'xl/worksheets/sheet1.xml': parts['xl/worksheets/sheet1.xml'].replace(
        '<v>2</v>',
        '<f>1+1</f><v>2</v>'
      ),
    })
  )
);
await assert.rejects(importRows('XLSX', encode({ ...parts, 'xl/bomb.xml': 'x'.repeat(2100000) })));
// An allowed part must reach the actual decompression cap, not fail the part allowlist.
await assert.rejects(
  importRows('XLSX', encode({ ...parts, 'xl/sharedStrings.xml': 'x'.repeat(1000001) })),
  /ZIP_LIMIT/
);
assert.equal((await importRows('CSV', csv)).length, 1);
console.log(
  'M3 parser passed: quoted CSV and real XLSX, bad headers/decimal/formula/expanded ZIP limit rejected; parser recovers after rejection'
);
