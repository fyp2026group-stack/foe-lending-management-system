import { csv, xlsx } from './report-export';
import { readAdminReport, type ReportName } from './services/admin-reports';

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
  const result = await readAdminReport(
    token(request), name as ReportName, payload, format !== 'json'
  );
  if ('status' in result) {
    return Response.json(
      { code: result.code },
      { status: result.status, headers: { 'Cache-Control': 'no-store' } }
    );
  }
  if (format === 'json') {
    return Response.json(result, { headers: { 'Cache-Control': 'no-store' } });
  }
  const { items: rows, total } = result;
  if (rows.length < total) {
    return Response.json(
      { code: 'EXPORT_TOO_LARGE' },
      { status: 413, headers: { 'Cache-Control': 'no-store' } }
    );
  }
  const filename = `${name}-report.${format}`;
  // Copy the ZIP bytes into an ArrayBuffer accepted by the Web Response API.
  // A Uint8Array<ArrayBufferLike> is not a guaranteed BodyInit in TS 5.9+.
  const binary = format === 'xlsx' ? xlsx(rows) : null;
  const body = binary
    ? Uint8Array.from(binary).buffer
    : csv(rows);
  return new Response(body, {
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
