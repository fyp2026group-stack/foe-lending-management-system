import { createHash, timingSafeEqual } from 'node:crypto';
import type { Prisma } from '@prisma/client';

export const APPLICATION_ROLES = [
  'ADMIN', 'STUDENT', 'LECTURER', 'TECHNICAL_OFFICER',
] as const;
export type ApplicationRole = typeof APPLICATION_ROLES[number];
type AuthFailure = { status: 401 | 403; code: 'UNAUTHENTICATED' | 'DENIED' | 'CSRF_DENIED' };
export type AuthorizedSession = { userId: string; roles: ApplicationRole[] };
export type AuthResult = AuthorizedSession | AuthFailure;

const sha256 = (value: string) => createHash('sha256').update(value).digest('hex');

/**
 * Native Prisma session verification. Call INSIDE the same database transaction
 * as the protected operation. The token is never stored or selected in cleartext.
 * Only use with the restricted lab_orm connection, never a browser/client SDK.
 */
export async function authorizePrismaSession(
  tx: Prisma.TransactionClient,
  token: string,
  options: { csrf?: string; requiredRoles?: readonly ApplicationRole[] } = {},
): Promise<AuthResult> {
  if (!/^[a-f0-9]{64}$/i.test(token)) return { status: 401, code: 'UNAUTHENTICATED' };
  const hash = sha256(token);
  const now = new Date();
  const session = await tx.sessions.findUnique({
    where: { token_hash: hash },
    select: {
      user_id: true, csrf_hash: true, revoked: true,
      expires_at: true, last_seen_at: true,
    },
  });
  if (!session || session.revoked || session.expires_at <= now ||
      session.last_seen_at.getTime() <= now.getTime() - 30 * 60_000) {
    return { status: 401, code: 'UNAUTHENTICATED' };
  }
  const user = await tx.users.findUnique({
    where: { id: session.user_id },
    select: { disabled: true },
  });
  if (!user || user.disabled) return { status: 401, code: 'UNAUTHENTICATED' };

  if (options.csrf !== undefined) {
    const computed = sha256(options.csrf);
    const expected = session.csrf_hash;
    if (!/^[a-f0-9]{64}$/i.test(expected) ||
        !timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(computed, 'hex'))) {
      return { status: 403, code: 'CSRF_DENIED' };
    }
  }

  const assigned = await tx.user_roles.findMany({
    where: { user_id: session.user_id },
    select: { role: true },
  });
  const roles = [...new Set(assigned.map(entry => entry.role))]
    .filter((role): role is ApplicationRole =>
      (APPLICATION_ROLES as readonly string[]).includes(role));
  const allowed = options.requiredRoles ?? APPLICATION_ROLES;
  if (!roles.some(role => allowed.includes(role))) {
    return { status: 403, code: 'DENIED' };
  }
  // Keep sliding-session expiry checks and activity touch atomic with the read.
  await tx.sessions.updateMany({
    where: {
      token_hash: hash,
      revoked: false,
      expires_at: { gt: now },
      last_seen_at: { gt: new Date(now.getTime() - 30 * 60_000) },
    },
    data: { last_seen_at: now },
  });
  return { userId: session.user_id, roles };
}

export function isAuthFailure(result: AuthResult): result is AuthFailure {
  return 'status' in result;
}
