import { readSnapshot } from '@/lib/server/store';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function GET() {
  try { readSnapshot(); return Response.json({ status: 'ok' }); }
  catch { return Response.json({ status: 'error' }, { status: 503 }); }
}
