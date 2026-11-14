import type { BorrowRequest, HistoryEvent, Loan } from './api';
const allowed: Readonly<Record<string, string>> = {
  LENDING_SUBMIT: 'Request submitted',
  LENDING_REQUESTS: 'Request submitted',
  LENDING_ISSUES: 'Equipment collected',
  LENDING_RETURNS: 'Equipment returned',
  LENDING_CANCEL: 'Request cancellation recorded',
  LENDING_REVISIONS: 'Correction draft created',
};
export type StudentActivity = {
  label: string;
  requestId: string;
  reference: string;
  occurredAt: string;
  key: string;
};
/** Only known borrowing events with a resolvable owned request can reach the student timeline. */
export function studentActivity(
  events: HistoryEvent[],
  requests: BorrowRequest[],
  loans: Loan[] = []
): StudentActivity[] {
  const targets = new Map<string, string>();
  for (const request of requests) {
    targets.set(request.id, request.id);
    for (const line of request.lines) targets.set(line.id, request.id);
  }
  for (const loan of loans)
    if (loan.requestId && requests.some((request) => request.id === loan.requestId))
      targets.set(loan.id, loan.requestId);
  const result: StudentActivity[] = [];
  for (const event of events) {
    const label = Object.hasOwn(allowed, event.action) ? allowed[event.action] : undefined;
    const requestId = targets.get(event.targetId);
    if (label && requestId && Number.isFinite(Date.parse(event.occurredAt)))
      result.push({
        label,
        requestId,
        reference: 'Request ' + requestId.slice(0, 8),
        occurredAt: event.occurredAt,
        key: event.action + ':' + event.targetId + ':' + event.occurredAt,
      });
  }
  // Decision snapshots carry stage/outcome; generic audit action names do not.
  for (const request of requests)
    for (const line of request.lines)
      for (const decision of line.decisions) {
        const label =
          decision.decision === 'REJECT'
            ? 'Request item rejected'
            : decision.decision === 'APPROVE' && decision.stage === 'LECTURER'
              ? 'Lecturer approved'
              : decision.decision === 'APPROVE' && decision.stage === 'HOD'
                ? 'HOD approved'
                : undefined;
        if (label && Number.isFinite(Date.parse(decision.createdAt)))
          result.push({
            label,
            requestId: request.id,
            reference: 'Request ' + request.id.slice(0, 8),
            occurredAt: decision.createdAt,
            key: decision.id,
          });
      }
  return result.sort((a, b) => b.occurredAt.localeCompare(a.occurredAt));
}
