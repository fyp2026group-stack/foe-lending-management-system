import { lending } from '@/lib/server/lending';
export const runtime = 'nodejs';
async function route(request: Request, { params }: { params: Promise<{ path: string[] }> }) {
  const correlationId = crypto.randomUUID();
  try {
    const result = await lending(request, (await params).path);
    const { status, ...data } = result;
    return Response.json(status ? { ...data, correlationId } : data, {
      status: status ?? 200,
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch {
    return Response.json(
      { code: 'UNAVAILABLE', correlationId },
      { status: 503, headers: { 'Cache-Control': 'no-store' } }
    );
  }
}
export { route as GET, route as POST };
