import { strToU8, zipSync } from 'fflate';

/** Preserve user-provided text as text, never as a spreadsheet formula. */
export function safeSpreadsheetText(value: unknown): string {
  const text =
    typeof value === 'object' && value !== null ? JSON.stringify(value) : String(value ?? '');
  return /^\s*[=+\-@]/.test(text) ? "'" + text : text;
}

/** XML 1.0 excludes most C0 controls and unpaired UTF-16 surrogates. */
function xml(value: unknown): string {
  return String(value ?? '')
    .toWellFormed()
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\uFFFE\uFFFF]/g, '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

/** Zero-based Excel column (0=A, 25=Z, 26=AA, 16383=XFD). */
export function xlsxColumn(index: number): string {
  if (!Number.isInteger(index) || index < 0 || index >= 16384)
    throw new RangeError('XLSX column index must be between 0 and 16383.');
  let number = index + 1;
  let column = '';
  while (number > 0) {
    number -= 1;
    column = String.fromCharCode(65 + (number % 26)) + column;
    number = Math.floor(number / 26);
  }
  return column;
}

const columns = (rows: Record<string, unknown>[]) => [
  ...new Set(rows.flatMap((row) => Object.keys(row))),
];

export function csv(rows: Record<string, unknown>[]): string {
  const keys = columns(rows);
  const quote = (value: unknown) => '"' + safeSpreadsheetText(value).replaceAll('"', '""') + '"';
  return (
    '\uFEFF' +
    [keys.map(quote).join(','), ...rows.map((row) => keys.map((key) => quote(row[key])).join(','))]
      .join('\r\n')
  );
}

export function xlsx(rows: Record<string, unknown>[]): Uint8Array {
  const keys = columns(rows);
  const all = [keys, ...rows.map((row) => keys.map((key) => safeSpreadsheetText(row[key])))];
  const sheet = all
    .map(
      (row, index) =>
        '<row r="' + (index + 1) + '">' +
        row
          .map(
            (value, column) =>
              '<c r="' + xlsxColumn(column) + (index + 1) +
              '" t="inlineStr"><is><t xml:space="preserve">' + xml(value) +
              '</t></is></c>'
          )
          .join('') +
        '</row>'
    )
    .join('');
  const files: Record<string, Uint8Array> = {
    '[Content_Types].xml': strToU8(
      '<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>'
    ),
    '_rels/.rels': strToU8(
      '<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>'
    ),
    'xl/workbook.xml': strToU8(
      '<?xml version="1.0"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Report" sheetId="1" r:id="rId1"/></sheets></workbook>'
    ),
    'xl/_rels/workbook.xml.rels': strToU8(
      '<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>'
    ),
    'xl/worksheets/sheet1.xml': strToU8(
      '<'.concat('?xml version="1.0"?','><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>',sheet,'</sheetData></worksheet>')
    ),
  };
  return zipSync(files, { level: 6 });
}
