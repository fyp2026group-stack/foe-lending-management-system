import { nativeOrmTransaction } from '../db';
import { authorizePrismaSession, isAuthFailure } from './prisma-session';
import { isUuid } from './uuid';

/** Borrower-owned draft listing; other users cannot inspect unpublished requests. */
export async function readLendingDrafts(token: string, payload: Record<string, unknown>) {
  if (Object.keys(payload).some(key => !['requestId', 'limit', 'offset'].includes(key)))
    return { status: 422, code: 'INVALID' };
  const integer = (v: unknown, fallback: number) =>
    v === undefined ? fallback :
      typeof v === 'string' && /^\d+$/.test(v) ? Number(v) : NaN;
  const limit = integer(payload.limit, 50), offset = integer(payload.offset, 0);
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > 100 ||
      !Number.isSafeInteger(offset) || offset < 0 || offset > 100000 ||
      (payload.requestId !== undefined && !isUuid(payload.requestId)))
    return { status: 422, code: 'INVALID' };
  return nativeOrmTransaction(async tx => {
    const auth = await authorizePrismaSession(tx, token);
    if (isAuthFailure(auth)) return auth;
    const rows = await tx.lend_drafts.findMany({
      where: {
        borrower_id: auth.userId,
        ...(payload.requestId ? { id: payload.requestId as string } : {}),
      },
      select: {
        id: true, payload: true, version: true, created_at: true,
        updated_at: true, submitted_id: true, cancelled: true,
        predecessor_id: true,
      },
      orderBy: [{ updated_at: 'desc' }, { id: 'asc' }],
      skip: offset, take: limit,
    });
    return {
      items: rows.map(draft => ({
        id: draft.id,
        payload: draft.payload,
        version: draft.version,
        createdAt: draft.created_at,
        updatedAt: draft.updated_at,
        submittedId: draft.submitted_id,
        cancelled: draft.cancelled,
        predecessorId: draft.predecessor_id,
      })),
      limit, offset,
    };
  });
}
