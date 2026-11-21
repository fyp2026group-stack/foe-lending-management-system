import { nativeOrmTransaction } from '../db';
import { authorizePrismaSession, isAuthFailure } from './prisma-session';

/**
 * Admit an inventory spreadsheet preview before expensive CPU-bound parsing.
 * Session, CSRF, officer role and the per-user three-per-minute budget are
 * checked atomically, preserving the original protected function semantics.
 */
export async function admitInventoryImport(token: string, csrf: string) {
  return nativeOrmTransaction(async tx => {
    await tx.$queryRaw`SELECT pg_advisory_xact_lock_shared(731942) IS NULL AS locked`;
    const auth = await authorizePrismaSession(tx, token, {
      csrf, requiredRoles: ['TECHNICAL_OFFICER'],
    });
    if (isAuthFailure(auth)) return { status: 403, code: 'DENIED' };
    const key = 'import:' + auth.userId;
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${key})) IS NULL AS locked`;
    const now = new Date();
    const expires = new Date(now.getTime() + 60_000);
    const current = await tx.login_limits.findUnique({ where: { key } });
    if (!current) {
      await tx.login_limits.createMany({ data: [{ key, attempts: 1, until_at: expires }] });
    } else if (current.until_at <= now) {
      await tx.login_limits.updateMany({
        where: { key }, data: { attempts: 1, until_at: expires },
      });
    } else {
      if (current.attempts >= 3) return { status: 429, code: 'LIMITED' };
      await tx.login_limits.updateMany({
        where: { key }, data: { attempts: { increment: 1 } },
      });
    }
    return { admitted: true };
  });
}
