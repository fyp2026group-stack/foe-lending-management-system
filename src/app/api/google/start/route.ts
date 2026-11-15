import { NextResponse } from 'next/server';
import { startGoogle } from '@/lib/server/google-oauth';

export const runtime = 'nodejs';
export async function GET() {
  try {
    const { url, flow } = startGoogle();
    const response = NextResponse.redirect(url);
    response.headers.append('Set-Cookie', flow);
    response.headers.set('Cache-Control', 'no-store');
    return response;
  } catch {
    return NextResponse.redirect(new URL('/login?google=unavailable', process.env.APP_ORIGIN ?? 'http://127.0.0.1:3000'));
  }
}
