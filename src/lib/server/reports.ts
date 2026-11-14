import { strToU8, zipSync } from 'fflate';
import { transaction, type Client } from './db';

const reports = new Set(['borrowing', 'overdue', 'inventory', 'approvals', 'audit']);
const allowed = new Set([
  'report',
  'format',
  'batchId',
  'labId',
  'categoryId',
  'itemId',
  'borrowerId',
  'lecturerId',
  'officerId',
  'from',
  'to',
  'status',
  'stage',
  'kind',
  'scope',
  'sort',
  'direction',
  'limit',
  'offset',
]);
const token = (request: Request) =>
  request.headers
    .get('cookie')
    ?.split(';')
    .map((value) => value.trim())
    .find((value) => value.startsWith('lab_session='))
    ?.slice(12) ?? '';
type Result = {
  status?: number;
  code?: string;
  report?: string;
  items?: Record<string, unknown>[];
  total?: number;
  limit?: number;
  offset?: number;
  metrics?: Record<string, unknown>;
};

function xml(value: unknown) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}
function safe(value: unknown) {
  const text =
    typeof value === 'object' && value !== null ? JSON.stringify(value) : String(value ?? '');
  return /^\s*[=+\-@]/.test(text) ? "'" + text : text;
}
function columns(rows: Record<string, unknown>[]) {
  return [...new Set(rows.flatMap((row) => Object.keys(row)))];
}
function csv(rows: Record<string, unknown>[]) {
  const keys = columns(rows),
    quote = (value: unknown) => '"' + safe(value).replaceAll('"', '""') + '"';
  return (
    '\uFEFF' +
    [
      keys.map(quote).join(','),
      ...rows.map((row) => keys.map((key) => quote(row[key])).join(',')),
    ].join('\r\n')
  );
}
function xlsx(rows: Record<string, unknown>[]) {
  const keys = columns(rows),
    all = [keys, ...rows.map((row) => keys.map((key) => safe(row[key])))];
  const sheet = all
    .map(
      (row, index) =>
        `<row r="${index + 1}">${row.map((value, column) => `<c r="${String.fromCharCode(65 + column)}${index + 1}" t="inlineStr"><is><t xml:space="preserve">${xml(value)}</t></is></c>`).join('')}</row>`
    )
    .join('');
  const files: { [key: string]: Uint8Array } = {
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
      `<?xml version="1.0"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${sheet}</sheetData></worksheet>`
    ),
  };
  return zipSync(files, { level: 6 });
}

export async function reportResponse(request: Request) {
  const url = new URL(request.url),
    params = url.searchParams;
  for (const key of params.keys())
    if (!allowed.has(key) || params.getAll(key).length !== 1)
      return Response.json(
        { code: 'INVALID' },
        { status: 422, headers: { 'Cache-Control': 'no-store' } }
      );
  const name = params.get('report') ?? '';
  if (!reports.has(name))
    return Response.json(
      { code: 'INVALID' },
      { status: 422, headers: { 'Cache-Control': 'no-store' } }
    );
  const format = params.get('format') ?? 'json';
  if (!['json', 'csv', 'xlsx'].includes(format))
    return Response.json(
      { code: 'INVALID' },
      { status: 422, headers: { 'Cache-Control': 'no-store' } }
    );
  const payload = Object.fromEntries(
    [...params].filter(([key]) => !['report', 'format'].includes(key))
  );
  const invoke = (client: Client, body: Record<string, string | number>) =>
    client
      .query('SELECT lab.admin_report($1,$2,$3) result', [token(request), name, body])
      .then((value) => value.rows[0].result as Result);
  const call = (body: Record<string, string | number>) =>
    transaction((client) => invoke(client, body));
  if (format === 'json') {
    const result = await call(payload);
    if (result.status)
      return Response.json(
        { code: result.code },
        { status: result.status, headers: { 'Cache-Control': 'no-store' } }
      );
    return Response.json(result, { headers: { 'Cache-Control': 'no-store' } });
  }
  const exported = await transaction(async (client) => {
    await client.query('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ');
    const rows: Record<string, unknown>[] = [];
    let offset = 0,
      total = 0;
    do {
      const result = await invoke(client, { ...payload, limit: 100, offset });
      if (result.status) return { result, rows, total };
      const page = result.items ?? [];
      rows.push(...page);
      total = result.total ?? rows.length;
      offset += page.length;
      if (!page.length) break;
    } while (rows.length < total && rows.length < 100000);
    return { rows, total };
  });
  if (exported.result?.status)
    return Response.json(
      { code: exported.result.code },
      { status: exported.result.status, headers: { 'Cache-Control': 'no-store' } }
    );
  const { rows, total } = exported;
  if (rows.length < total)
    return Response.json(
      { code: 'EXPORT_TOO_LARGE' },
      { status: 413, headers: { 'Cache-Control': 'no-store' } }
    );
  const filename = `${name}-report.${format}`;
  return new Response(format === 'csv' ? csv(rows) : xlsx(rows), {
    headers: {
      'Cache-Control': 'no-store',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Type':
        format === 'csv'
          ? 'text/csv; charset=utf-8'
          : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    },
  });
}
