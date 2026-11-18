import { boundedBody } from './work';
import { readLendingPolicies } from './services/lending-policies';
import { readEligibleLecturers } from './services/lending-lecturers';
import { readLendingComments, writeLendingComment } from './services/lending-comments';
import { readLendingDrafts } from './services/lending-drafts';
import { changeLendingPolicy } from './services/lending-policy-mutations';
import { createLendingRequest } from './services/lending-request-mutations';
import { decideLendingRequest } from './services/lending-decisions';
import { reserveLendingLine } from './services/lending-reservations';
import { issueLendingAllocation } from './services/lending-handovers';
import { receiveLendingReturn } from './services/lending-returns';
import { readLendingRequests } from './services/lending-request-reads';
import { readLendingLoans } from './services/lending-loan-reads';
import { changePhysicalInspection } from './services/lending-inspection-mutations';
import { changeLendingExtension } from './services/lending-extension-mutations';
import { changeLendingDraft } from './services/lending-draft-mutations';
import { cancelLending } from './services/lending-cancellations';
import { readBorrowingSources } from './services/lending-source-reads';
import { readPhysicalLending } from './services/lending-physical-reads';
import { readOfficerOperations } from './services/lending-operations-summary';
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
  if (name === 'policies') {
    return request.method === 'GET'
      ? readLendingPolicies(token, payload)
      : changeLendingPolicy(token, csrf, payload);
  }
  if (request.method === 'GET' && name === 'sources')
    return readBorrowingSources(token, payload);
  if (request.method === 'GET' && name === 'operations-summary')
    return readOfficerOperations(token, payload);
  if (request.method === 'GET' &&
      ['borrowed','expected','overdue','inspections','maintenance',
       'extensions','borrower-history','handover-assets'].includes(name))
    return readPhysicalLending(token,
      name as 'borrowed'|'expected'|'overdue'|'inspections'|'maintenance'|
        'extensions'|'borrower-history'|'handover-assets',payload);
  if (request.method === 'GET' && name === 'lecturers') {
    return readEligibleLecturers(token, payload);
  }
  if (request.method !== 'GET' && (name === 'inspections' || name === 'maintenance')) {
    return changePhysicalInspection(token, csrf, name, payload);
  }
  if (request.method !== 'GET' &&
      (name === 'extensions' || name === 'extension-decisions')) {
    return changeLendingExtension(token, csrf, name, payload);
  }
  if (request.method !== 'GET' &&
      (name === 'drafts' || name === 'submit' || name === 'revisions')) {
    return changeLendingDraft(token, csrf, name, payload);
  }
  if (request.method !== 'GET' && name === 'cancel') {
    return cancelLending(token, csrf, payload);
  }
  if (request.method !== 'GET' && name === 'returns') {
    return receiveLendingReturn(token, csrf, payload);
  }
  if (request.method !== 'GET' && name === 'issues') {
    return issueLendingAllocation(token, csrf, payload);
  }
  if (request.method !== 'GET' && name === 'reserve') {
    return reserveLendingLine(token, csrf, payload);
  }
  if (request.method !== 'GET' && name === 'decisions') {
    return decideLendingRequest(token, csrf, payload);
  }
  if (request.method !== 'GET' && name === 'requests') {
    return createLendingRequest(token, csrf, payload);
  }
  if (request.method === 'GET' &&
      ['loans', 'history', 'ready', 'allocations', 'metrics'].includes(name)) {
    return readLendingLoans(token, name as 'loans' | 'history' | 'ready' | 'allocations' | 'metrics', payload);
  }
  if (request.method === 'GET' && name === 'requests') {
    return readLendingRequests(token, payload);
  }
  if (request.method === 'GET' && name === 'drafts') {
    return readLendingDrafts(token, payload);
  }
  if (name === 'comments') {
    return request.method === 'GET'
      ? readLendingComments(token, payload)
      : writeLendingComment(token, csrf, payload);
  }
  return { status: 404, code: 'NOT_FOUND' };
}
