import { NextResponse } from 'next/server';
import {
  applicationCookie, connectGoogle, finishGoogle, flowCookie, oauthCookie,
  signupCookie, signupTicket,
} from '@/lib/server/google-oauth';
export const runtime = 'nodejs';

export async function GET(request: Request) {
  const origin = process.env.APP_ORIGIN ?? 'http://127.0.0.1:3000';
  const redirect = (path: string) => {
    const response = NextResponse.redirect(new URL(path, origin));
    response.headers.append('Set-Cookie', oauthCookie(flowCookie, '', 0));
    response.headers.set('Cache-Control', 'no-store');
    return response;
  };
  try {
    const identity = await finishGoogle(request);
    const session = await connectGoogle(identity);
    if (session.token) {
      const response = redirect('/workspace');
      response.headers.append('Set-Cookie', applicationCookie(session.token));
      response.headers.append('Set-Cookie', oauthCookie(signupCookie, '', 0));
      return response;
    }
    if (session.code === 'PROFILE_REQUIRED') {
      const response = redirect('/student/register');
      response.headers.append('Set-Cookie', signupTicket(identity));
      return response;
    }
    return redirect('/login?google=account');
  } catch {
    return redirect('/login?google=denied');
  }
}
