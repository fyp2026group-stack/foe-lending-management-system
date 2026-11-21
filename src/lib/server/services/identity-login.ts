import { createHash, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';
import { nativeOrmTransaction } from '../db';
import { derive } from '../work';

const digest = (value: string) => createHash('sha256').update(value).digest('hex');

async function verifyPassword(password: string, encoded: string) {
  const [kind, salt, key] = encoded.split('$');
  const valid = kind === 'scrypt' &&
    /^[a-f0-9]{32}$/.test(salt ?? '') && /^[a-f0-9]{128}$/.test(key ?? '');
  const computed = await derive(password, valid ? salt : 'fixed-dummy-salt');
  return Boolean(valid && timingSafeEqual(computed, Buffer.from(key, 'hex')));
}

type LoginFailure = { status: 401 | 422 | 429; code: string };
export async function loginIdentity(email: string, password: string):
  Promise<LoginFailure | { token: string; csrfToken: string }> {
  const normalized = email.toLowerCase().trim();
  if (normalized.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized) ||
      !password || password.length > 128)
    return { status: 422, code: 'INVALID_LOGIN' };
  const admitted = await nativeOrmTransaction(async tx => {
    await tx.$queryRaw`SELECT pg_advisory_xact_lock_shared(731942) IS NULL AS locked`;
    // Deterministic lock order protects the unknown-account budget and
    // credential-specific budget against concurrent attempts.
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(731945) IS NULL AS locked`;
    const existing = await tx.users.findUnique({
      where: { email: normalized },
      select: { id: true, disabled: true, password_hash: true },
    });
    const active = existing && !existing.disabled ? existing : null;
    const keys = [
      ...(!active ? ['login-unknown'] : []),
      'login-account:' + digest(normalized),
    ];
    const now = new Date();
    const expiry = new Date(now.getTime() + 15 * 60_000);
    for (const key of keys) {
      const old = await tx.login_limits.findUnique({ where: { key } });
      const cap = key === 'login-unknown' ? 20 : 10;
      if (!old) {
        await tx.login_limits.createMany({
          data: [{ key, attempts: 1, until_at: expiry }],
        });
      } else if (old.until_at <= now) {
        await tx.login_limits.updateMany({
          where: { key }, data: { attempts: 1, until_at: expiry },
        });
      } else {
        if (old.attempts >= cap) return { status: 429 as const, code: 'LOGIN_LIMITED' };
        await tx.login_limits.updateMany({
          where: { key }, data: { attempts: { increment: 1 } },
        });
      }
    }
    return { credential: active?.password_hash ?? '', userId: active?.id ?? null };
  });
  if (admitted.status === 429) return { status: 429, code: 'LOGIN_LIMITED' };

  const valid = await verifyPassword(password, admitted.credential);
  return nativeOrmTransaction(async tx => {
    await tx.$queryRaw`SELECT pg_advisory_xact_lock_shared(731942) IS NULL AS locked`;
    // Revalidate the stored credential before creating a session: a concurrent
    // disable or credential change must invalidate the previous proof.
    const current = admitted.userId
      ? await tx.users.findUnique({
          where: { id: admitted.userId },
          select: { id: true, disabled: true, password_hash: true },
        }) : null;
    if (!valid || !current || current.disabled ||
        current.password_hash !== admitted.credential) {
      await tx.audit.createMany({
        data: [{ id: randomUUID(), action: 'LOGIN_DENIED' }],
      });
      return { status: 401 as const, code: 'INVALID_LOGIN' };
    }
    const token = randomBytes(32).toString('hex');
    const csrfToken = digest(token + ':csrf');
    await tx.sessions.createMany({
      data: [{
        token_hash: digest(token), user_id: current.id,
        csrf_hash: digest(csrfToken),
        expires_at: new Date(Date.now() + 8 * 3600_000), revoked: false,
      }],
    });
    await tx.audit.createMany({
      data: [{ id: randomUUID(), actor_id: current.id,
        target_id: current.id, action: 'LOGIN' }],
    });
    return { token, csrfToken };
  });
}
