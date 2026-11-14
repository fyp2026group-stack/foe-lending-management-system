import { NextResponse, type NextRequest } from 'next/server';
import { transaction } from '@/lib/server/db';
import { canOpenRoute, type AppRole } from '@/lib/role-policy';

/** Runs before streamed Server Components; never use sidebar visibility for authorization. */
export async function proxy(request: NextRequest) {
  const { pathname, searchParams } = request.nextUrl;
  const headers = { 'Cache-Control': 'no-store' };
  if (pathname === '/design-system')
    return new NextResponse('Not Found', { status: 404, headers });
  const token = request.cookies.get('lab_session')?.value ?? '';
  if (!/^[a-f0-9]{64}$/.test(token))
    return NextResponse.redirect(new URL('/login', request.url), 307);
  let result: { status?: number; user?: { roles?: AppRole[]; id?: string } };
  try {
    result = await transaction(async (client) =>
      (await client.query(
        "SELECT lab.identity_call($1,'','me',NULL,'{}'::jsonb) AS result",
        [token]
      )).rows[0].result
    );
  } catch {
    return NextResponse.json({ code: 'SESSION_CHECK_UNAVAILABLE' }, { status: 503, headers });
  }
  if (!result?.user?.id || result.status === 401)
    return NextResponse.redirect(new URL('/login', request.url), 307);
  if (!canOpenRoute(pathname, searchParams.get('view'), result.user.roles ?? []))
    return new NextResponse('Not Found', { status: 404, headers });
  const response = NextResponse.next();
  response.headers.set('Cache-Control', 'no-store');
  return response;
}

export const config = {
  matcher: [
    '/workspace/:path*',
    '/admin/:path*',
    '/operations/:path*',
    '/inventory/:path*',
    '/borrowing/:path*',
    '/design-system/:path*',
  ],
};
