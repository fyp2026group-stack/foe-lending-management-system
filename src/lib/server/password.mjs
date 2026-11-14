import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
export function hashPassword(password) {
  if (typeof password !== 'string' || password.length < 12 || password.length > 128)
    throw new Error('Password must contain 12–128 characters');
  const salt = randomBytes(16).toString('hex');
  return `scrypt$${salt}$${scryptSync(password, salt, 64, { N: 16384, r: 8, p: 1, maxmem: 33554432 }).toString('hex')}`;
}
export function verifyPassword(password, encoded) {
  if (typeof password !== 'string' || password.length > 128) return false;
  const parts = encoded.split('$');
  if (
    parts.length !== 3 ||
    parts[0] !== 'scrypt' ||
    !/^[a-f0-9]{32}$/.test(parts[1]) ||
    !/^[a-f0-9]{128}$/.test(parts[2])
  )
    return false;
  return timingSafeEqual(
    scryptSync(password, parts[1], 64, { N: 16384, r: 8, p: 1, maxmem: 33554432 }),
    Buffer.from(parts[2], 'hex')
  );
}
