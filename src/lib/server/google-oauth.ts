import {
  createCipheriv, createDecipheriv, createHash, createPublicKey,
  randomBytes, timingSafeEqual, verify,
} from 'node:crypto';
import { transaction } from '@/lib/server/db';

export type GoogleIdentity = { sub: string; email: string; name: string };
type Flow = { state: string; verifier: string; nonce: string };
export const flowCookie = 'foe_google_flow';
export const signupCookie = 'foe_google_signup';

function configuration() {
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
  const cookieSecret = process.env.GOOGLE_OAUTH_COOKIE_SECRET;
  const origin = process.env.APP_ORIGIN ?? 'http://127.0.0.1:3000';
  if (!clientId || !clientSecret || !cookieSecret || cookieSecret.length < 32) {
    throw new Error('GOOGLE_STUDENT_OAUTH_NOT_CONFIGURED');
  }
  if (process.env.NODE_ENV === 'production' && !origin.startsWith('https://'))
    throw new Error('GOOGLE_OAUTH_HTTPS_REQUIRED');
  return { clientId, clientSecret, cookieSecret, origin };
}
function equal(a: string, b: string) {
  const left = Buffer.from(a), right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}
function seal(value: unknown, purpose: string, seconds: number) {
  const { cookieSecret } = configuration();
  const key = createHash('sha256').update(purpose + ':' + cookieSecret).digest();
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(JSON.stringify({ value, expires: Date.now() + seconds * 1000 })), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), encrypted]).toString('base64url');
}
function open<T>(sealed: string | undefined, purpose: string): T | null {
  if (!sealed || sealed.length > 3900) return null;
  try {
    const { cookieSecret } = configuration();
    const data = Buffer.from(sealed, 'base64url');
    if (data.length < 29) return null;
    const key = createHash('sha256').update(purpose + ':' + cookieSecret).digest();
    const decipher = createDecipheriv('aes-256-gcm', key, data.subarray(0, 12));
    decipher.setAuthTag(data.subarray(12, 28));
    const content = JSON.parse(Buffer.concat([decipher.update(data.subarray(28)), decipher.final()]).toString('utf8'));
    if (!Number.isSafeInteger(content.expires) || content.expires < Date.now()) return null;
    return content.value as T;
  } catch { return null; }
}
export function cookie(request: Request, key: string): string | undefined {
  return request.headers.get('cookie')?.split(';').map(s => s.trim())
    .find(s => s.startsWith(key + '='))?.slice(key.length + 1);
}
export function oauthCookie(name: string, value: string, age = 600) {
  return name + '=' + value + '; Path=/api/google; HttpOnly; SameSite=Lax; Max-Age=' + age +
    (process.env.NODE_ENV === 'production' ? '; Secure' : '');
}
export function applicationCookie(token: string) {
  return 'lab_session=' + token + '; HttpOnly; SameSite=Strict; Path=/; Max-Age=28800' +
    (process.env.NODE_ENV === 'production' ? '; Secure' : '');
}
export function startGoogle() {
  const { clientId, origin } = configuration();
  const flow: Flow = {
    state: randomBytes(32).toString('base64url'),
    verifier: randomBytes(32).toString('base64url'),
    nonce: randomBytes(32).toString('base64url'),
  };
  const challenge = createHash('sha256').update(flow.verifier).digest('base64url');
  const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  const params = {
    response_type: 'code', client_id: clientId, redirect_uri: origin + '/api/google/callback',
    scope: 'openid email profile', state: flow.state, nonce: flow.nonce,
    code_challenge: challenge, code_challenge_method: 'S256', prompt: 'select_account',
  };
  Object.entries(params).forEach(([k,v]) => url.searchParams.set(k,v));
  return { url: url.toString(), flow: oauthCookie(flowCookie, seal(flow, 'flow', 600)) };
}
export function signupIdentity(request: Request): GoogleIdentity | null {
  return open<GoogleIdentity>(cookie(request, signupCookie), 'signup');
}
export function signupTicket(identity: GoogleIdentity) {
  return oauthCookie(signupCookie, seal(identity, 'signup', 900), 900);
}
function verifiedGoogleIdentity(claims: Record<string, unknown>): GoogleIdentity {
  const email = typeof claims.email === 'string' ? claims.email.toLowerCase().trim() : '';
  // Allow any verified Google account, including gmail.com. The stable Google
  // sub proves account ownership, not university enrollment or student numbers.
  if (claims.email_verified !== true ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
      email.length > 254 ||
      typeof claims.sub !== 'string' || claims.sub.length < 10) {
    throw new Error('GOOGLE_VERIFIED_ACCOUNT_REQUIRED');
  }
  return { sub: claims.sub, email, name: typeof claims.name === 'string' ? claims.name.slice(0,120) : '' };
}
async function verifyGoogleIdToken(idToken: string, expectedNonce: string) {
  const parts = idToken.split('.');
  if (parts.length !== 3 || parts.some(p => p.length > 6000)) throw new Error('INVALID_ID_TOKEN');
  const header = JSON.parse(Buffer.from(parts[0], 'base64url').toString('utf8')) as Record<string,unknown>;
  const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8')) as Record<string,unknown>;
  if (header.alg !== 'RS256' || typeof header.kid !== 'string') throw new Error('INVALID_JWT_ALGORITHM');
  const jwksResponse = await fetch('https://www.googleapis.com/oauth2/v3/certs', {
    cache: 'no-store', signal: AbortSignal.timeout(8000),
  });
  if (!jwksResponse.ok) throw new Error('GOOGLE_KEYS_UNAVAILABLE');
  const jwks = await jwksResponse.json() as { keys: Array<Record<string,unknown>> };
  const jwk = jwks.keys?.find(k => k.kid === header.kid && k.kty === 'RSA' && k.alg === 'RS256' && k.use === 'sig');
  if (!jwk) throw new Error('UNKNOWN_GOOGLE_KEY');
  const valid = verify('RSA-SHA256', Buffer.from(parts[0] + '.' + parts[1]),
    createPublicKey({ key: jwk, format: 'jwk' }), Buffer.from(parts[2], 'base64url'));
  const { clientId } = configuration();
  const now = Math.floor(Date.now() / 1000);
  if (!valid || !['https://accounts.google.com','accounts.google.com'].includes(String(payload.iss)) ||
      payload.aud !== clientId || (payload.azp && payload.azp !== clientId) ||
      typeof payload.exp !== 'number' || payload.exp <= now ||
      typeof payload.iat !== 'number' || payload.iat > now + 120 ||
      typeof payload.nonce !== 'string' || !equal(payload.nonce,expectedNonce)) {
    throw new Error('GOOGLE_ID_TOKEN_REJECTED');
  }
  return verifiedGoogleIdentity(payload);
}
export async function finishGoogle(request: Request) {
  const params = new URL(request.url).searchParams;
  const flow = open<Flow>(cookie(request, flowCookie), 'flow');
  if (!flow || params.has('error') || !params.get('state') || !equal(flow.state, params.get('state')!) ||
      !params.get('code')) throw new Error('GOOGLE_OAUTH_STATE_DENIED');
  const { clientId, clientSecret, origin } = configuration();
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST', signal: AbortSignal.timeout(8000),
    headers: {'Content-Type':'application/x-www-form-urlencoded'},
    body: new URLSearchParams({
      code: params.get('code')!, client_id: clientId, client_secret: clientSecret,
      redirect_uri: origin + '/api/google/callback', grant_type: 'authorization_code',
      code_verifier: flow.verifier,
    }),
  });
  if (!response.ok) throw new Error('GOOGLE_TOKEN_EXCHANGE_FAILED');
  const result = await response.json() as { id_token?: string };
  if (!result.id_token) throw new Error('GOOGLE_ID_TOKEN_MISSING');
  return verifyGoogleIdToken(result.id_token, flow.nonce);
}
type SessionResult = { status?: number; code?: string; token?: string };
export async function connectGoogle(identity: GoogleIdentity): Promise<SessionResult> {
  return transaction(async client => (
    await client.query('SELECT lab.google_student_login($1,$2) AS result',[identity.sub,identity.email])
  ).rows[0].result as SessionResult);
}
export async function registerGoogle(identity: GoogleIdentity, profile: unknown): Promise<SessionResult> {
  return transaction(async client => (
    await client.query('SELECT lab.google_student_register($1,$2,$3::jsonb) AS result',[identity.sub,identity.email,profile])
  ).rows[0].result as SessionResult);
}
export async function getGoogleBatches(): Promise<{batches: Array<{id:string;name:string}>}> {
  return transaction(async client => (
    await client.query('SELECT lab.google_student_options() AS result')
  ).rows[0].result);
}
export function expectedOrigin(request: Request) {
  const { origin } = configuration();
  return new URL(request.url).origin === origin && request.headers.get('origin') === origin;
}
