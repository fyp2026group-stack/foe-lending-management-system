/**
 * Domain-level request approval gate for the Prisma service migration.
 *
 * This module does not access the database: callers must load decisions and
 * equipment lines in one transaction, enforce actor authorization, and lock
 * the request before calling it. It is intentionally not wired to the live
 * lending endpoint until the Prisma service has parity coverage.
 */
export type ApprovalRole = 'LECTURER' | 'HOD';
export type EquipmentApprovalPolicy = 'NONE' | 'LECTURER' | 'HOD' | 'BOTH';
export type ApprovalDecision = 'APPROVE' | 'REJECT';

export type RequestedEquipment = {
  policy: EquipmentApprovalPolicy;
  quantity: number;
  cancelledQuantity: number;
};

export type RequestApproval = {
  role: ApprovalRole;
  decision: ApprovalDecision;
};

export type ApprovalGate =
  | { state: 'EMPTY'; requires: readonly ApprovalRole[]; missing: readonly ApprovalRole[] }
  | { state: 'REJECTED'; requires: readonly ApprovalRole[]; missing: readonly ApprovalRole[] }
  | { state: 'PENDING'; requires: readonly ApprovalRole[]; missing: readonly ApprovalRole[] }
  | { state: 'APPROVED'; requires: readonly ApprovalRole[]; missing: readonly ApprovalRole[] };

function validPolicy(value: string): value is EquipmentApprovalPolicy {
  return value === 'NONE' || value === 'LECTURER' || value === 'HOD' || value === 'BOTH';
}

export function requestApprovalGate(
  lines: readonly RequestedEquipment[],
  approvals: readonly RequestApproval[]
): ApprovalGate {
  if (!Array.isArray(lines) || !Array.isArray(approvals)) throw new Error('INVALID');
  const active = lines.filter(line => {
    if (
      !validPolicy(line.policy) ||
      !Number.isSafeInteger(line.quantity) ||
      !Number.isSafeInteger(line.cancelledQuantity) ||
      line.quantity <= 0 ||
      line.cancelledQuantity < 0 ||
      line.cancelledQuantity > line.quantity
    ) throw new Error('INVALID_REQUEST_LINE');
    return line.quantity > line.cancelledQuantity;
  });

  if (!active.length) return { state: 'EMPTY', requires: [], missing: [] };

  const roles: ApprovalRole[] = [];
  if (active.some(l => l.policy === 'LECTURER' || l.policy === 'BOTH')) roles.push('LECTURER');
  if (active.some(l => l.policy === 'HOD' || l.policy === 'BOTH')) roles.push('HOD');

  const votes = new Map<ApprovalRole, ApprovalDecision>();
  for (const approval of approvals) {
    if (
      (approval.role !== 'LECTURER' && approval.role !== 'HOD') ||
      (approval.decision !== 'APPROVE' && approval.decision !== 'REJECT') ||
      votes.has(approval.role) ||
      !roles.includes(approval.role)
    ) throw new Error('INVALID_APPROVAL');
    votes.set(approval.role, approval.decision);
  }

  const missing = roles.filter(role => !votes.has(role));
  if ([...votes.values()].includes('REJECT')) return { state: 'REJECTED', requires: roles, missing };
  if (missing.length) return { state: 'PENDING', requires: roles, missing };
  return { state: 'APPROVED', requires: roles, missing: [] };
}

/** Only an approved *whole request* is permitted to enter stock allocation. */
export function assertRequestMayReserve(gate: ApprovalGate): void {
  if (gate.state !== 'APPROVED') throw new Error('REQUEST_APPROVAL_INCOMPLETE');
}
