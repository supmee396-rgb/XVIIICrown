import { readSnapshot } from '@/lib/server/store';
import { corsHeaders } from '@/lib/server/cors';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function GET(request: Request) {
  try { readSnapshot(); return Response.json({ status: 'ok' }, { headers: corsHeaders(request) }); }
  catch { return Response.json({ status: 'error' }, { status: 503, headers: corsHeaders(request) }); }
}
