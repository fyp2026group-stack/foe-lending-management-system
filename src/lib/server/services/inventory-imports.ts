import { nativeOrmTransaction } from '../db';
import { authorizePrismaSession, isAuthFailure } from './prisma-session';
import { isUuid } from './uuid';

function pagination(payload: Record<string, unknown>) {
  if (Object.keys(payload).some(key => !['limit', 'offset'].includes(key))) return null;
  const value = (v: unknown, fallback: number) =>
    v === undefined ? fallback : typeof v === 'string' && /^\d+$/.test(v) ? Number(v) :
      typeof v === 'number' && Number.isSafeInteger(v) ? v : NaN;
  const limit = value(payload.limit, 20);
  const offset = value(payload.offset, 0);
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > 100 ||
    !Number.isSafeInteger(offset) || offset < 0 || offset > 10000) return null;
  return { limit, offset };
}

/** Import preview history is private to the user who submitted the import. */
export async function readInventoryImports(token: string, payload: Record<string, unknown>) {
  const page = pagination(payload);
  if (!page) return { status: 422, code: 'INVALID' };
  return nativeOrmTransaction(async tx => {
    const auth = await authorizePrismaSession(tx, token);
    if (isAuthFailure(auth)) return auth;
    const imports = await tx.inv_imports.findMany({
      where: { owner_id: auth.userId },
      select: { id: true, committed: true, rows: true },
      orderBy: { id: 'asc' },
      take: page.limit,
      skip: page.offset,
    });
    return {
      items: imports.map(item => ({
        id: item.id,
        committed: item.committed,
        row_count: Array.isArray(item.rows) ? item.rows.length : 0,
      })),
      ...page,
    };
  });
}

/** Never expose an import to another user, including administrators. */
export async function readInventoryImportDetail(token: string, importId: string) {
  if (!isUuid(importId)) return { status: 422, code: 'INVALID' };
  return nativeOrmTransaction(async tx => {
    const auth = await authorizePrismaSession(tx, token);
    if (isAuthFailure(auth)) return auth;
    const existing = await tx.inv_imports.findFirst({
      where: { id: importId, owner_id: auth.userId },
      select: { id: true, committed: true, rows: true },
    });
    if (!existing) return { status: 404, code: 'NOT_FOUND' };
    return {
      id: existing.id,
      committed: existing.committed,
      rows: existing.rows,
    };
  });
}
