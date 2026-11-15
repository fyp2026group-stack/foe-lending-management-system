import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { derive, boundedBody } from './work';
import { transaction } from './db';
import { runAdmitted } from './admission';
async function verify(p: string, encoded: string) {
  const [kind, salt, key] = encoded.split('$');
  const valid =
    kind === 'scrypt' && /^[a-f0-9]{32}$/.test(salt ?? '') && /^[a-f0-9]{128}$/.test(key ?? '');
  const actual = await derive(p, valid ? salt : 'fixed-dummy-salt');
  return valid && timingSafeEqual(actual, Buffer.from(key, 'hex'));
}
const cookie = (r: Request) =>
  r.headers
    .get('cookie')
    ?.split(';')
    .map((s) => s.trim())
    .find((s) => s.startsWith('lab_session='))
    ?.slice(12) ?? '';
export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string
  ) {
    super(code);
  }
}
const fail = (status: number, code: string): never => {
  throw new ApiError(status, code);
};
export async function recordDenial(r: Request, code: string) {
  await transaction(async (c) => {
    await c.query('SELECT lab.denial($1,$2)', [cookie(r), code]);
  });
}
export async function handle(
  r: Request,
  path: string[]
): Promise<{ data: unknown; status?: number; cookie?: string }> {
  const write = r.method !== 'GET';
  if (
    write &&
    r.headers.get('content-length') !== '0' &&
    r.headers.get('content-type')?.split(';')[0] !== 'application/json' &&
    !r.url.endsWith('/auth/logout')
  )
    fail(415, 'JSON_REQUIRED');
  if (write && r.headers.get('origin') !== (process.env.APP_ORIGIN ?? 'http://127.0.0.1:3000'))
    fail(403, 'ORIGIN_DENIED');
  if (write && Number(r.headers.get('content-length') ?? 0) > 16384) fail(413, 'TOO_LARGE');
  let text = '';
  try {
    text = write ? await boundedBody(r) : '';
  } catch {
    fail(413, 'TOO_LARGE');
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let body: Record<string, any> = {};
  try {
    body = text ? JSON.parse(text) : {};
  } catch {
    fail(422, 'INVALID_JSON');
  }
  const isObject = (value: unknown) =>
    value !== null && typeof value === 'object' && !Array.isArray(value);
  if (!isObject(body)) fail(422, 'INVALID_OBJECT');
  const uuid = (v: unknown) =>
    typeof v === 'string' &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(v);
  const bounded = (v: unknown, max: number) =>
    typeof v === 'string' && v.trim().length > 0 && v.length <= max;
  const route = path.join('/');
  const login = route === 'auth/login' && r.method === 'POST';
  const auth =
    (route === 'auth/me' && r.method === 'GET') ||
    (route === 'auth/logout' && r.method === 'POST') ||
    login;
  const collection =
    path.length === 2 &&
    path[0] === 'admin' &&
    ['users', 'batches', 'laboratories'].includes(path[1]) &&
    ['GET', 'POST'].includes(r.method);
  const patch =
    path.length === 3 &&
    path[0] === 'admin' &&
    ['users', 'batches', 'laboratories'].includes(path[1]) &&
    r.method === 'PATCH' &&
    uuid(path[2]);
  if (!auth && !collection && !patch) fail(404, 'NOT_FOUND');
  const fields = login
    ? ['email', 'password']
    : patch
      ? path[1] === 'users'
        ? ['displayName', 'registrationNumber', 'roles', 'disabled', 'laboratoryIds', 'batchIds']
        : ['name', 'active']
      : collection && r.method === 'POST'
        ? path[1] === 'users'
          ? [
              'email',
              'displayName',
              'password',
              'roles',
              'batchId',
              'batchIds',
              'registrationNumber',
              'laboratoryIds',
            ]
          : ['name']
        : [];
  if (Object.keys(body).some((k) => !fields.includes(k))) fail(422, 'UNSUPPORTED_FIELD');
  if (
    login &&
    (!bounded(body.email, 254) ||
      !/^\S+@\S+\.\S+$/.test(body.email) ||
      !bounded(body.password, 128))
  )
    fail(422, 'INVALID_LOGIN');
  if (patch && path[1] === 'users' && typeof body.disabled !== 'boolean')
    fail(422, 'INVALID_DISABLED');
  if (patch && path[1] === 'users' && body.laboratoryIds === undefined)
    fail(422, 'LABORATORIES_REQUIRED');
  if (patch && path[1] !== 'users' && typeof body.active !== 'boolean') fail(422, 'INVALID_ACTIVE');
  if (collection && r.method === 'POST' && path[1] === 'users') {
    if (
      !bounded(body.email, 254) ||
      !/^\S+@\S+\.\S+$/.test(body.email) ||
      !bounded(body.displayName, 120) ||
      !bounded(body.password, 128) ||
      body.password.length < 12
    )
      fail(422, 'INVALID_USER');
    if (body.batchId !== undefined && !uuid(body.batchId)) fail(422, 'INVALID_BATCH');
    if (body.registrationNumber !== undefined && !bounded(body.registrationNumber, 80))
      fail(422, 'INVALID_REGISTRATION');
    if (body.batchIds === undefined && body.batchId !== undefined) body.batchIds = [body.batchId];
    if (
      Array.isArray(body.roles) &&
      body.roles.includes('STUDENT') &&
      (!Array.isArray(body.batchIds) ||
        body.batchIds.length === 0 ||
        !bounded(body.registrationNumber, 80))
    )
      fail(422, 'STUDENT_PROFILE_REQUIRED');
  }
  if (
    path[1] === 'users' &&
    body.batchIds !== undefined &&
    (!Array.isArray(body.batchIds) ||
      body.batchIds.length > 100 ||
      body.batchIds.some((v: unknown) => !uuid(v)) ||
      new Set(body.batchIds).size !== body.batchIds.length)
  )
    fail(422, 'INVALID_BATCHES');
  if (
    body.laboratoryIds !== undefined &&
    (!Array.isArray(body.laboratoryIds) ||
      body.laboratoryIds.length > 100 ||
      body.laboratoryIds.some((v: unknown) => !uuid(v)) ||
      new Set(body.laboratoryIds).size !== body.laboratoryIds.length)
  )
    fail(422, 'INVALID_LABS');
  if (
    body.laboratoryIds?.length &&
    (!Array.isArray(body.roles) ||
      !body.roles.some((role: string) => ['LECTURER', 'TECHNICAL_OFFICER'].includes(role)))
  )
    fail(422, 'STAFF_ROLE_REQUIRED');
  const call = async (op: string, target: string | null, p: unknown) =>
    transaction(
      async (c) =>
        (
          await c.query('SELECT lab.identity_call($1,$2,$3,$4,$5::jsonb) AS result', [
            cookie(r),
            r.headers.get('x-csrf-token') ?? '',
            op,
            target,
            p,
          ])
        ).rows[0].result
    );
  const governance = async (op: string, target: string | null, p: unknown) =>
    transaction(
      async (c) =>
        (
          await c.query('SELECT lab.admin_governance($1,$2,$3,$4,$5::jsonb) AS result', [
            cookie(r),
            r.headers.get('x-csrf-token') ?? '',
            op,
            target,
            p,
          ])
        ).rows[0].result
    );
  const resultResponse = (result: Record<string, unknown>) => {
    if (typeof result.status === 'number')
      return { status: result.status, data: { code: result.code } };
    return { data: result };
  };
  if (login) {
    const started = await transaction(
      async (c) =>
        (await c.query('SELECT lab.login_start($1) AS result', [body.email.trim().toLowerCase()]))
          .rows[0].result
    );
    if (started.status) return resultResponse(started);
    const valid = await verify(body.password, started.passwordHash);
    const secret = process.env.LOGIN_VERIFIER_SECRET;
    if (!secret || secret.length < 32) fail(503, 'VERIFIER_UNAVAILABLE');
    const proof = valid
      ? createHmac('sha256', secret!).update(started.challengeId).digest('hex')
      : 'invalid';
    const result = await transaction(
      async (c) =>
        (await c.query('SELECT lab.login_finish($1,$2) AS result', [started.challengeId, proof]))
          .rows[0].result
    );
    if (result.status) return resultResponse(result);
    return {
      data: { csrfToken: result.csrfToken },
      cookie:
        'lab_session=' +
        result.token +
        '; HttpOnly; SameSite=Strict; Path=/; Max-Age=28800' +
        (process.env.NODE_ENV === 'production' ? '; Secure' : ''),
    };
  }
  if (route === 'auth/me') return resultResponse(await call('me', null, {}));
  if (route === 'auth/logout') {
    const result = await call('logout', null, {});
    return {
      ...resultResponse(result),
      ...(result.status
        ? {}
        : { cookie: 'lab_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0' }),
    };
  }
  let op = path[1];
  if (r.method === 'POST') {
    op = { users: 'create_user', batches: 'create_batch', laboratories: 'create_laboratory' }[
      path[1]
    ]!;
    if (path[1] === 'users') {
      const admitted = await runAdmitted(
        async () =>
          transaction(
            async (c) =>
              (
                await c.query('SELECT lab.admin_hash_admit($1,$2) AS result', [
                  cookie(r),
                  r.headers.get('x-csrf-token') ?? '',
                ])
              ).rows[0].result
          ),
        async () => {
          const salt = randomBytes(16).toString('hex');
          body.passwordHash =
            'scrypt$' + salt + '$' + (await derive(body.password, salt)).toString('hex');
          delete body.password;
          return { admitted: true, status: undefined, code: undefined };
        }
      );
      if (admitted.status) {
        await recordDenial(r, admitted.code ?? 'DENIED');
        return resultResponse(admitted);
      }
    }
  } else if (patch)
    op = { users: 'patch_user', batches: 'patch_batch', laboratories: 'patch_laboratory' }[
      path[1]
    ]!;
  if (collection && r.method === 'GET') op = 'read_' + path[1];
  const result = await governance(op, patch ? path[2] : null, body);
  if (result.status === 401 || result.code === 'CSRF_DENIED') await recordDenial(r, result.code);
  return {
    ...resultResponse(result),
    ...(!result.status && r.method === 'POST' ? { status: 201 } : {}),
  };
}
