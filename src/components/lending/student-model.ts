import type { BorrowDraft, BorrowRequest, Loan, DraftPayload } from './api';
export const basketKey = (userId: string) => 'student-request-selection:' + userId;
export function readSelection(raw: string | null): DraftPayload['lines'] {
  try {
    const lines: unknown = JSON.parse(raw ?? 'null');
    if (!Array.isArray(lines) || !lines.length || lines.length > 20) return [];
    const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (
      !lines.every(
        (l) =>
          l &&
          uuid.test(l.itemId) &&
          uuid.test(l.labId) &&
          uuid.test(l.locationId) &&
          Number.isInteger(l.quantity) &&
          l.quantity > 0 &&
          l.quantity <= 1000
      )
    )
      return [];
    if (new Set(lines.map(sourceKey)).size !== lines.length) return [];
    return lines.map((l) => ({
      itemId: l.itemId,
      labId: l.labId,
      locationId: l.locationId,
      quantity: l.quantity,
    }));
  } catch {
    return [];
  }
}
export const isStudent = (roles: string[]) =>
  roles.includes('STUDENT') &&
  !roles.some((role) => ['ADMIN', 'LECTURER', 'TECHNICAL_OFFICER'].includes(role));
export const sourceKey = (source: { itemId: string; labId: string; locationId: string }) =>
  [source.itemId, source.labId, source.locationId].join(':');
export function studentCounts(
  drafts: BorrowDraft[],
  requests: BorrowRequest[],
  loans: Loan[],
  now: number
) {
  return [
    drafts.filter((d) => !d.cancelled && !d.submittedId).length,
    requests.filter((r) => r.lines.some((l) => ['LECTURER', 'HOD'].includes(l.stage))).length,
    requests.filter((r) => r.lines.some((l) => l.reservedQuantity > 0)).length,
    loans.filter((l) => l.returned < l.quantity).length,
    loans.filter((l) => isStudentOverdue(l, now)).length,
  ];
}
export function approvalPath(policy: string) {
  return policy === 'BOTH'
    ? 'Lecturer -> HOD'
    : policy === 'LECTURER'
      ? 'Lecturer'
      : policy === 'HOD'
        ? 'HOD'
        : policy === 'NONE'
          ? 'No academic approval'
          : 'Approval requirement unavailable';
}

export const needsStudentAttention = (request: BorrowRequest) =>
  request.lines.some((line) => line.stage === 'REJECTED' || line.reservedQuantity > 0);
export const isStudentOverdue = (loan: Loan, now: number) =>
  loan.returned < loan.quantity && Boolean(loan.dueAt && Date.parse(loan.dueAt) < now);
export function persistStudentSelection(
  storage: Pick<Storage, 'setItem' | 'removeItem'>,
  userId: string,
  lines: DraftPayload['lines']
) {
  if (lines.length) storage.setItem(basketKey(userId), JSON.stringify(lines));
  else storage.removeItem(basketKey(userId));
}
