import { transaction } from './db';
import { boundedBody } from './work';
const reads = new Set([
  'policies',
  'lecturers',
  'sources',
  'requests',
  'allocations',
  'loans',
  'history',
  'ready',
  'metrics',
  'comments',
  'drafts',
  'borrowed',
  'expected',
  'overdue',
  'inspections',
  'maintenance',
  'extensions',
  'borrower-history',
  'handover-assets',
  'operations-summary',
]);
const writes = new Set([
  'policies',
  'requests',
  'decisions',
  'reserve',
  'issues',
  'returns',
  'comments',
  'drafts',
  'submit',
  'cancel',
  'revisions',
  'inspections',
  'maintenance',
  'extensions',
  'extension-decisions',
]);
export async function lending(request: Request, path: string[]) {
  const name = path[0];
  if (path.length !== 1 || (!reads.has(name) && !writes.has(name)))
    return { status: 404, code: 'NOT_FOUND' };
  const token =
    request.headers
      .get('cookie')
      ?.split(';')
      .map((x) => x.trim())
      .find((x) => x.startsWith('lab_session='))
      ?.slice(12) ?? '';
  const csrf = request.headers.get('x-csrf-token') ?? '';
  let payload: Record<string, unknown> = {};
  if (request.method === 'GET') {
    if (!reads.has(name)) return { status: 404, code: 'NOT_FOUND' };
    const params = new URL(request.url).searchParams;
    const allowed = new Set([
      'loanId',
      'allocationId',
      'requestId',
      'labId',
      'batchId',
      'from',
      'to',
      'status',
      'stage',
      'limit',
      'offset',
    ]);
    for (const [key, value] of params) {
      if (!allowed.has(key) || params.getAll(key).length !== 1)
        return { status: 422, code: 'INVALID' };
      payload[key] = value;
    }
  } else {
    if (!writes.has(name)) return { status: 404, code: 'NOT_FOUND' };
    if (request.headers.get('origin') !== (process.env.APP_ORIGIN ?? 'http://127.0.0.1:3000'))
      return { status: 403, code: 'ORIGIN_DENIED' };
    if (request.headers.get('content-type')?.split(';')[0] !== 'application/json')
      return { status: 415, code: 'JSON_REQUIRED' };
    try {
      payload = JSON.parse(await boundedBody(request, 100000));
      if (!payload || typeof payload !== 'object' || Array.isArray(payload)) throw Error();
    } catch {
      return { status: 422, code: 'INVALID' };
    }
  }
  return transaction(
    async (c) =>
      (
        await c.query('SELECT lab.lending_call($1,$2,$3,$4) AS result', [
          token,
          csrf,
          (request.method === 'GET' ? 'read_' : '') + name,
          payload,
        ])
      ).rows[0].result
  );
}
