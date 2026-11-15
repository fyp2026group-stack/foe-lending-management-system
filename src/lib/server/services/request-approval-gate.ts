/**
 * Request-wide approval policy used by the Prisma lending domain.
 *
 * Every active line contributes its own required approvals. An approval for
 * item A cannot satisfy the same role on item B. The result can be used as
 * a precondition to reserve or hand over stock only after the database
 * transaction has locked the corresponding request and all relevant lines.
 */
export type ApprovalRole = 'LECTURER' | 'HOD';
export type EquipmentApprovalPolicy = 'NONE' | 'LECTURER' | 'HOD' | 'BOTH';
export type ApprovalDecision = 'APPROVE' | 'REJECT';

export type RequestedEquipment = {
  id: string;
  policy: EquipmentApprovalPolicy;
  quantity: number;
  cancelledQuantity: number;
};

export type RequestApproval = {
  lineId: string;
  role: ApprovalRole;
  decision: ApprovalDecision;
};

export type ApprovalRequirement = { lineId: string; role: ApprovalRole };
export type ApprovalGate = {
  state: 'EMPTY' | 'REJECTED' | 'PENDING' | 'APPROVED';
  requires: readonly ApprovalRequirement[];
  missing: readonly ApprovalRequirement[];
};

function validPolicy(policy: string): policy is EquipmentApprovalPolicy {
  return ['NONE', 'LECTURER', 'HOD', 'BOTH'].includes(policy);
}

export function requestApprovalGate(
  lines: readonly RequestedEquipment[],
  approvals: readonly RequestApproval[]
): ApprovalGate {
  if (!Array.isArray(lines) || !Array.isArray(approvals)) throw new Error('INVALID');
  const known = new Set<string>();
  for (const line of lines) {
    if (
      !line.id || typeof line.id !== 'string' || known.has(line.id) ||
      !validPolicy(line.policy) ||
      !Number.isSafeInteger(line.quantity) ||
      !Number.isSafeInteger(line.cancelledQuantity) ||
      line.quantity <= 0 ||
      line.cancelledQuantity < 0 ||
      line.cancelledQuantity > line.quantity
    ) throw new Error('INVALID_REQUEST_LINE');
    known.add(line.id);
  }

  const active = lines.filter(line => line.cancelledQuantity < line.quantity);
  const allRequirements: ApprovalRequirement[] = lines.flatMap((line) => {
    switch (line.policy) {
      case 'NONE': return [];
      case 'LECTURER': return [{ lineId: line.id, role: 'LECTURER' as const }];
      case 'HOD': return [{ lineId: line.id, role: 'HOD' as const }];
      case 'BOTH': return [
        { lineId: line.id, role: 'LECTURER' as const },
        { lineId: line.id, role: 'HOD' as const },
      ];
      default: throw new Error('INVALID_REQUEST_LINE');
    }
  });
  const activeIds = new Set(active.map(line => line.id));
  const requirements = allRequirements.filter(req => activeIds.has(req.lineId));
  const allowedKeys = new Set(allRequirements.map(req => `${req.lineId}:${req.role}`));
  const requiredKeys = new Set(requirements.map(req => `${req.lineId}:${req.role}`));
  const keyed = new Map<string, ApprovalDecision>();
  const seen = new Set<string>();
  for (const approval of approvals) {
    if (
      !known.has(approval.lineId) ||
      !['LECTURER', 'HOD'].includes(approval.role) ||
      !['APPROVE', 'REJECT'].includes(approval.decision)
    ) throw new Error('INVALID_APPROVAL');
    const key = `${approval.lineId}:${approval.role}`;
    if (seen.has(key) || !allowedKeys.has(key)) throw new Error('INVALID_APPROVAL');
    seen.add(key);
    // An approval remains valid immutable history after cancellation, but
    // cancelled items contribute no pending requirements or rejection veto.
    if (requiredKeys.has(key)) keyed.set(key, approval.decision);
  }
  if (active.length === 0) return { state: 'EMPTY', requires: [], missing: [] };
  const missing = requirements.filter(req => !keyed.has(`${req.lineId}:${req.role}`));
  const state = [...keyed.values()].includes('REJECT')
    ? 'REJECTED'
    : missing.length > 0 ? 'PENDING' : 'APPROVED';
  return { state, requires: requirements, missing };
}

/** Reserve and handover both require the *entire request* to be approved. */
export function assertRequestMayReserve(gate: ApprovalGate): void {
  if (gate.state !== 'APPROVED') throw new Error('REQUEST_APPROVAL_INCOMPLETE');
}
