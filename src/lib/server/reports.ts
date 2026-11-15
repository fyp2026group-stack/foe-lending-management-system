import { csv, xlsx } from './report-export';
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
      .query('SELECT lab.admin_report($1,$2,$3::jsonb) result', [token(request), name, body])
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
