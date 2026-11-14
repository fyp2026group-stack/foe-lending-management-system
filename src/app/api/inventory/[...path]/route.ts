import { inventory } from '@/lib/server/inventory';
export const runtime = 'nodejs';
async function route(request: Request, { params }: { params: Promise<{ path: string[] }> }) {
  const correlationId = crypto.randomUUID();
  try {
    const result = await inventory(request, (await params).path);
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
export { route as GET, route as POST, route as PATCH };
