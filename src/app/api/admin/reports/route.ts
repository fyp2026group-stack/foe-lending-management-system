import { reportResponse } from '@/lib/server/reports';
export const runtime = 'nodejs';
export async function GET(request: Request) {
  try {
    return await reportResponse(request);
  } catch {
    return Response.json(
      { code: 'UNAVAILABLE', correlationId: crypto.randomUUID() },
      { status: 503, headers: { 'Cache-Control': 'no-store' } }
    );
  }
}
