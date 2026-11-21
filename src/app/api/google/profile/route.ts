import { NextResponse } from 'next/server';
import {
  applicationCookie, expectedOrigin, getGoogleBatches, oauthCookie, registerGoogle,
  signupCookie, signupIdentity,
} from '@/lib/server/google-oauth';
import { boundedBody } from '@/lib/server/work';

export const runtime = 'nodejs';
export async function GET(request: Request) {
  const identity = signupIdentity(request);
  if (!identity) return NextResponse.json({ code: 'SIGNUP_EXPIRED' }, { status: 401 });
  try {
    const options = await getGoogleBatches();
    return NextResponse.json({
      email: identity.email,
      name: identity.name,
      batches: options.batches,
    }, { headers: { 'Cache-Control': 'no-store' } });
  } catch {
    return NextResponse.json({ code: 'UNAVAILABLE' }, { status: 503 });
  }
}

export async function POST(request: Request) {
  if (!expectedOrigin(request)) return NextResponse.json({ code: 'ORIGIN_DENIED' }, { status: 403 });
  const identity = signupIdentity(request);
  if (!identity) return NextResponse.json({ code: 'SIGNUP_EXPIRED' }, { status: 401 });
  if (request.headers.get('content-type')?.split(';')[0] !== 'application/json')
    return NextResponse.json({ code: 'JSON_REQUIRED' }, { status: 415 });
  let body: unknown;
  try {
    body = JSON.parse(await boundedBody(request, 4096));
  } catch {
    return NextResponse.json({ code: 'INVALID_PROFILE' }, { status: 422 });
  }
  if (!body || typeof body !== 'object' || Array.isArray(body))
    return NextResponse.json({ code: 'INVALID_PROFILE' }, { status: 422 });
  try {
    const result = await registerGoogle(identity, body);
    if (!result.token)
      return NextResponse.json({ code: result.code ?? 'INVALID_PROFILE' }, { status: result.status ?? 422 });
    const response = NextResponse.json({ ok: true }, { headers: { 'Cache-Control': 'no-store' } });
    response.headers.append('Set-Cookie', applicationCookie(result.token));
    response.headers.append('Set-Cookie', oauthCookie(signupCookie, '', 0));
    return response;
  } catch {
    return NextResponse.json({ code: 'UNAVAILABLE' }, { status: 503 });
  }
}
