import { createHash, randomUUID } from 'node:crypto';
import { nativeOrmTransaction } from '../db';
import { authorizePrismaSession, isAuthFailure } from './prisma-session';

const sha = (s: string) => createHash('sha256').update(s).digest('hex');

/** Return only safe profile fields; do not disclose password hashes. */
export async function currentIdentity(token: string) {
  return nativeOrmTransaction(async tx => {
    const auth = await authorizePrismaSession(tx, token);
    if (isAuthFailure(auth)) return auth;
    const user = await tx.users.findUnique({
      where: { id: auth.userId },
      select: { id: true, display_name: true, email: true },
    });
    if (!user) return { status: 401, code: 'UNAUTHENTICATED' };
    return {
      user: {
        id: user.id, displayName: user.display_name, email: user.email,
        roles: [...auth.roles].sort(),
      },
      csrfToken: sha(token + ':csrf'),
    };
  });
}

/** Revoke the current session and audit logout, without exposing session data. */
export async function logoutIdentity(token: string, csrf: string) {
  return nativeOrmTransaction(async tx => {
    const auth = await authorizePrismaSession(tx, token, { csrf });
    if (isAuthFailure(auth)) return auth;
    const updated = await tx.sessions.updateMany({
      where: { token_hash: sha(token), revoked: false },
      data: { revoked: true },
    });
    if (updated.count !== 1) return { status: 401, code: 'UNAUTHENTICATED' };
    await tx.audit.createMany({
      data: [{ id: randomUUID(), actor_id: auth.userId,
        target_id: auth.userId, action: 'LOGOUT' }],
    });
    return { ok: true };
  });
}
