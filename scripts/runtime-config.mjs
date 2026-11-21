import { existsSync, readFileSync } from 'node:fs';
import { parseEnv } from 'node:util';

// Injected deployment configuration always wins. Never consult local secrets
// in production, or silently replace an invalid injected connection.
export function runtimeConfig(env, file) {
  const result = { ...env };
  if (!result.ORM_DATABASE_URL && result.NODE_ENV !== 'production' && existsSync(file)) {
    const local = parseEnv(readFileSync(file, 'utf8'));
    let url;
    try { url = new URL(local.ORM_DATABASE_URL); } catch { /* sanitized below */ }
    if (!url || !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)) {
      throw new Error('Local runtime configuration must use a loopback database.');
    }
    for (const [key, value] of Object.entries(local)) result[key] ??= value;
  }
  let url;
  let role;
  try {
    url = new URL(result.ORM_DATABASE_URL);
    role = decodeURIComponent(url.username).split('.')[0];
  } catch { /* sanitized below */ }
  if (!url || !['postgres:', 'postgresql:'].includes(url.protocol) ||
      role !== 'lab_orm') {
    throw new Error('Runtime requires ORM_DATABASE_URL for the restricted lab_orm PostgreSQL role. For local setup run npm run local:config; deployments must inject ORM_DATABASE_URL.');
  }
  return result;
}
