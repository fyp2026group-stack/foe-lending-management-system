import type { BorrowRequest, RequestLine } from './api';
export function cancellableQuantity(line: RequestLine) {
  return ['REJECTED', 'CANCELLED'].includes(line.stage)
    ? 0
    : Math.max(0, line.quantity - line.cancelledQuantity - line.issuedQuantity);
}
export function requestGroup(request: BorrowRequest) {
  if (['CANCELLED', 'REJECTED'].includes(request.summary)) return 'closed';
  if (['FULFILLED', 'PARTIALLY_FULFILLED'].includes(request.summary)) return 'borrowed';
  if (request.summary === 'READY') return 'ready';
  return 'pending';
}
export function requestQuery({
  status = '',
  stage = '',
  from = '',
  to = '',
  offset = 0,
  requestId = '',
}: {
  status?: string;
  stage?: string;
  from?: string;
  to?: string;
  offset?: number;
  requestId?: string;
}) {
  const params = new URLSearchParams({ limit: '20', offset: String(offset) });
  for (const [key, value] of Object.entries({ status, stage, from, to, requestId }))
    if (value) params.set(key, value);
  return 'requests?' + params;
}

export function draftSavePayload(
  payload: import('./api').DraftPayload,
  draft?: { id: string; version: number }
) {
  return { ...payload, ...(draft ? { draftId: draft.id, expectedVersion: draft.version } : {}) };
}
export function draftSubmitPayload(draft: { id: string; version: number }) {
  return { draftId: draft.id, expectedVersion: draft.version };
}
export class CommandReplay {
  pending?: { path: string; payload: string; commandId: string };
  prepare(path: string, body: unknown) {
    const payload = JSON.stringify(body);
    if (this.pending && (this.pending.path !== path || this.pending.payload !== payload))
      throw Error('Outcome unknown. Retry the unchanged action before editing.');
    this.pending ??= { path, payload, commandId: crypto.randomUUID() };
    return { ...(body as Record<string, unknown>), commandId: this.pending.commandId };
  }
  resolve() {
    this.pending = undefined;
  }
}
