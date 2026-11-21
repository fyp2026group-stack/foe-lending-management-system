import { NextResponse, type NextRequest } from 'next/server';
import { currentIdentity } from '@/lib/server/services/identity-session';
import { canOpenRoute, type AppRole } from '@/lib/role-policy';

/** Runs before streamed Server Components; never use sidebar visibility for authorization. */
export async function proxy(request: NextRequest) {
  const { pathname, searchParams } = request.nextUrl;
  const headers = { 'Cache-Control': 'no-store' };
  if (pathname === '/login') {
    // Never render/serialize arbitrary login query values into HTML or RSC.
    const google = searchParams.get('google');
    const allowedGoogle = ['unavailable', 'account', 'denied', 'expired'].includes(google ?? '');
    const clean = new URL('/login', request.url);
    if (allowedGoogle) clean.searchParams.set('google', google!);
    const response = request.method !== 'GET' && request.method !== 'HEAD' ||
      searchParams.toString() !== clean.searchParams.toString()
      ? NextResponse.redirect(clean, 303)
      : NextResponse.next();
    response.headers.set('Cache-Control', 'no-store');
    response.headers.set('Referrer-Policy', 'no-referrer');
    return response;
  }
  if (pathname === '/design-system')
    return new NextResponse('Not Found', { status: 404, headers });
  const token = request.cookies.get('lab_session')?.value ?? '';
  if (!/^[a-f0-9]{64}$/.test(token))
    return NextResponse.redirect(new URL('/login', request.url), 307);
  let result: Awaited<ReturnType<typeof currentIdentity>>;
  try {
    result = await currentIdentity(token);
  } catch {
    return NextResponse.json({ code: 'SESSION_CHECK_UNAVAILABLE' }, { status: 503, headers });
  }
  if ('status' in result || !result.user?.id)
    return NextResponse.redirect(new URL('/login', request.url), 307);
  if (!canOpenRoute(pathname, searchParams.get('view'), result.user.roles as AppRole[]))
    return new NextResponse('Not Found', { status: 404, headers });
  const response = NextResponse.next();
  response.headers.set('Cache-Control', 'no-store');
  return response;
}

export const config = {
  matcher: [
    '/login',
    '/workspace/:path*',
    '/admin/:path*',
    '/operations/:path*',
    '/inventory/:path*',
    '/equipment/:path*',
    '/borrowing/:path*',
    '/design-system/:path*',
  ],
};
