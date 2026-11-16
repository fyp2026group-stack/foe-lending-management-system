import { createHash } from 'node:crypto';
import { nativeOrmTransaction } from '../db';
import { isUuid } from './uuid';

type Response =
  | { items: { id: string; displayName: string; labIds: string[] }[]; limit: number; offset: number }
  | { status: number; code: string };

function pageOf(payload: Record<string, unknown>) {
  if (Object.keys(payload).some(key => !['labId', 'limit', 'offset'].includes(key))) {
    return null;
  }
  const numeric = (value: unknown, fallback: number) =>
    value === undefined ? fallback
      : typeof value === 'string' && /^\d+$/.test(value) ? Number(value) : NaN;
  const limit = numeric(payload.limit, 50);
  const offset = numeric(payload.offset, 0);
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > 100
    || !Number.isSafeInteger(offset) || offset < 0 || offset > 100000
    || (payload.labId !== undefined && !isUuid(payload.labId))) return null;
  return { limit, offset, labId: payload.labId as string | undefined };
}

/**
 * Native Prisma lecturer directory. Same active-session, disabled-account
 * and current role/lab rules as the legacy read_lecturers function.
 * Exposes no email, credentials or session data to API callers.
 */
export async function readEligibleLecturers(
  token: string,
  payload: Record<string, unknown>
): Promise<Response> {
  const page = pageOf(payload);
  if (!page) return { status: 422, code: 'INVALID' };
  return nativeOrmTransaction(async tx => {
    const hash = createHash('sha256').update(token).digest('hex');
    const session = token ? await tx.sessions.findUnique({
      where: { token_hash: hash },
      select: { user_id: true, revoked: true, expires_at: true, last_seen_at: true },
    }) : null;
    const now = new Date();
    if (!session || session.revoked || session.expires_at <= now
      || session.last_seen_at.getTime() <= now.getTime() - 30 * 60_000) {
      return { status: 401, code: 'UNAUTHENTICATED' };
    }
    const user = await tx.users.findUnique({
      where: { id: session.user_id }, select: { disabled: true },
    });
    if (!user || user.disabled) return { status: 401, code: 'UNAUTHENTICATED' };
    const roles = await tx.user_roles.findMany({
      where: { user_id: session.user_id }, select: { role: true },
    });
    if (!roles.some(row =>
      ['ADMIN','STUDENT','LECTURER','TECHNICAL_OFFICER'].includes(row.role)
    )) return { status: 403, code: 'DENIED' };
    await tx.sessions.updateMany({
      where: { token_hash: hash }, data: { last_seen_at: now },
    });
    const users = await tx.users.findMany({
      where: {
        disabled: false,
        id: { not: session.user_id },
        user_roles: { some: { role: 'LECTURER' } },
        staff_labs: {
          some: page.labId ? { laboratory_id: page.labId } : {},
        },
      },
      select: {
        id: true,
        display_name: true,
        staff_labs: {
          select: { laboratory_id: true },
          orderBy: { laboratory_id: 'asc' },
        },
      },
      orderBy: [{ display_name: 'asc' }, { id: 'asc' }],
      skip: page.offset,
      take: page.limit,
    });
    return {
      items: users.map(user => ({
        id: user.id,
        displayName: user.display_name,
        labIds: user.staff_labs.map(lab => lab.laboratory_id),
      })),
      limit: page.limit,
      offset: page.offset,
    };
  });
}
