import { api } from '@/components/identity/api';
export type Page<T> = { items: T[]; limit?: number; offset?: number };
export type Lecturer = { id: string; displayName: string; labIds: string[] };
export type LendingSource = {
  itemId: string;
  item: string;
  kind: 'RETURNABLE' | 'CONSUMABLE';
  uom: string;
  labId: string;
  lab: string;
  locationId: string;
  location: string;
  availableQuantity: number;
  policy: 'NONE' | 'LECTURER' | 'HOD' | 'BOTH';
};
export type Policy = { itemId: string; name: string; policy: string; hodId?: string };
export type Decision = {
  id: string;
  actorId: string;
  actor: string;
  stage: string;
  decision: string;
  remarks: string;
  createdAt: string;
};
export type RequestLine = {
  id: string;
  itemId: string;
  item: string;
  labId: string;
  locationId: string;
  quantity: number;
  policy: string;
  stage: string;
  lecturerId?: string;
  hodId?: string;
  version: number;
  cancelledQuantity: number;
  issuedQuantity: number;
  reservedQuantity: number;
  lab?: string;
  location?: string;
  decisions: Decision[];
};
export type BorrowRequest = {
  id: string;
  purpose: string;
  borrowerId: string;
  borrower: string;
  batchId?: string | null;
  collectAt: string;
  returnAt: string;
  version: number;
  summary: string;
  revision: number;
  predecessorId?: string;
  createdAt: string;
  lines: RequestLine[];
};
export type LendingComment = {
  id: string;
  requestId: string;
  authorId: string;
  author: string;
  body: string;
  correctsId: string | null;
  createdAt: string;
};
export type Metrics = {
  metrics: {
    loans: number;
    issuedQuantity: number;
    outstandingQuantity: number;
    overdueLoans: number;
  };
};
export type HandoverFact = {
  loan_id: string;
  actor_id: string;
  movement_id: string;
  remarks: string | null;
  created_at: string;
};
export type OperationsSummary = {
  from: string;
  to: string;
  laboratories: { id: string; name: string }[];
  completed: {
    handovers: number;
    receipts: number;
    inspections: number;
    maintenance: number;
    total: number;
  };
};
export type Allocation = {
  labName?: string;
  id: string;
  lineId: string;
  quantity: number;
  issued: number;
  itemId: string;
  item: string;
  labId: string;
  locationId: string;
  borrowerId: string;
  borrower: string;
};
export type Loan = {
  labName?: string;
  handover?: HandoverFact | null;
  issuedAt?: string;
  requestId?: string;
  version?: number;
  id: string;
  borrowerId: string;
  borrower: string;
  assetId: string;
  quantity: number;
  returned: number;
  dueAt: string | null;
  status?: 'active' | 'overdue' | 'history';
  item: string;
  labId: string;
};
export type HistoryEvent = { action: string; targetId: string; occurredAt: string };
export function lendingRead<T>(path: string, signal?: AbortSignal) {
  return api<T>('/api/lending/' + path, { signal });
}
export function lendingWrite<T>(path: string, body: unknown, csrfToken: string) {
  return api<T>('/api/lending/' + path, { method: 'POST', body, csrfToken });
}

export type DraftPayload = {
  purpose?: string;
  collectAt?: string;
  returnAt?: string;
  lecturerId?: string;
  lines: { itemId: string; labId: string; locationId: string; quantity: number }[];
};
export type BorrowDraft = {
  id: string;
  payload: DraftPayload;
  version: number;
  submittedId?: string;
  cancelled: boolean;
  predecessorId?: string;
  updatedAt: string;
};
