import { createHash, randomUUID } from 'node:crypto';
import { nativeOrmTransaction } from '../db';

const permitted = new Set([
  'CSRF_DENIED','ORIGIN_DENIED','INVALID','INVALID_JSON','INVALID_OBJECT',
  'UNSUPPORTED_FIELD','TOO_LARGE','DENIED','UNAUTHENTICATED',
]);
export async function recordNativeDenial(token: string, reason: string): Promise<void> {
  await nativeOrmTransaction(async tx => {
    await tx.$queryRaw`SELECT pg_advisory_xact_lock_shared(731942) IS NULL AS locked`;
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(731945) IS NULL AS locked`;
    const key = 'denial-audit', now = new Date(), until = new Date(Date.now() + 60_000);
    const counter = await tx.login_limits.findUnique({ where: { key } });
    let attempts = 0;
    if (!counter) {
      await tx.login_limits.createMany({
        data: [{ key, attempts: 0, until_at: until }],
      });
    } else if (counter.until_at > now) attempts = counter.attempts;
    else await tx.login_limits.updateMany({
      where: { key }, data: { attempts: 0, until_at: until },
    });

    if (attempts >= 100) {
      const current = await tx.denial_suppression.findUnique({
        where: { singleton: true },
        select: { suppressed: true },
      });
      if (!current) {
        await tx.denial_suppression.createMany({
          data: [{ singleton: true, suppressed: BigInt(1), last_suppressed_at: now }],
        });
      } else {
        await tx.denial_suppression.updateMany({
          where: { singleton: true },
          data: {
            suppressed: current.suppressed >= BigInt('9223372036854775807')
              ? current.suppressed : current.suppressed + BigInt(1),
            last_suppressed_at: now,
          },
        });
      }
      return;
    }
    await tx.login_limits.updateMany({
      where: { key }, data: { attempts: { increment: 1 } },
    });
    let actor: string | null = null;
    if (/^[0-9a-f]{64}$/i.test(token)) {
      const session = await tx.sessions.findUnique({
        where: { token_hash: createHash('sha256').update(token).digest('hex') },
        select: {
          user_id: true, revoked: true, expires_at: true, last_seen_at: true,
          users: { select: { disabled: true } },
        },
      });
      if (session && !session.revoked && !session.users.disabled &&
          session.expires_at > now && session.last_seen_at >
          new Date(now.getTime() - 30 * 60_000)) actor = session.user_id;
    }
    await tx.audit.createMany({
      data: [{ id: randomUUID(), actor_id: actor,
        action: 'CALLER_REPORTED_DENIAL',
        details: {
          code: permitted.has(reason) ? reason : 'INVALID',
          attribution: 'validated token only; caller report not proven event',
        } }],
    });
  });
}
