import { inventory } from '@/lib/server/inventory';
export const runtime = 'nodejs';
async function route(request: Request, { params }: { params: Promise<{ path: string[] }> }) {
  const correlationId = crypto.randomUUID();
  try {
    const result = await inventory(request, (await params).path);
    const { status, ...data } = result as Record<string, unknown>;
    return Response.json(status ? { ...data, correlationId } : data, {
      status: typeof status === 'number' ? status : 200,
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch (error) {
    // Diagnostic details are restricted to synthetic, non-production CI runs.
    if (process.env.NODE_ENV !== 'production' && process.env.M2_TEST_ENABLE === 'synthetic-only') {
      const detail = error instanceof Error ? error.message : 'unknown exception';
      console.error('INVENTORY_SYNTHETIC_TEST_FAILURE', error instanceof Error ? error.name : 'Unknown',
        detail.replace(/postgres(?:ql)?:\/\/\S+/gi, '[redacted]').slice(0, 500));
    }
    return Response.json(
      { code: 'UNAVAILABLE', correlationId },
      { status: 503, headers: { 'Cache-Control': 'no-store' } }
    );
  }
}
export { route as GET, route as POST, route as PATCH };
