import { nativeOrmTransaction } from '../db';
import { isUuid } from './uuid';
import { authorizePrismaSession, isAuthFailure } from './prisma-session';

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
    const auth = await authorizePrismaSession(tx, token);
    if (isAuthFailure(auth)) return auth;
    const users = await tx.users.findMany({
      where: {
        disabled: false,
        id: { not: auth.userId },
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
