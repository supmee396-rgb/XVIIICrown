import { readSnapshot } from '@/lib/server/store';
import { executeCommand, InputError } from '@/lib/server/actions';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  try { return Response.json(readSnapshot(), { headers: { 'Cache-Control': 'no-store' } }); }
  catch (error) {
    console.error('Could not read queue database', error);
    return Response.json({ error: 'อ่านข้อมูลไม่สำเร็จ กรุณาลองอีกครั้ง' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const origin = request.headers.get('origin');
  let sameOrigin = !origin;
  try { if (origin) sameOrigin = new URL(origin).host === request.headers.get('host'); } catch { /* Reject malformed origins. */ }
  if (!sameOrigin) {
    return Response.json({ error: 'ไม่อนุญาตคำขอจากเว็บไซต์อื่น' }, { status: 403 });
  }
  if (!request.headers.get('content-type')?.startsWith('application/json')) {
    return Response.json({ error: 'ต้องส่งข้อมูลแบบ JSON' }, { status: 415 });
  }
  try {
    const body = await request.text();
    if (body.length > 8192) return Response.json({ error: 'ข้อมูลมีขนาดใหญ่เกินไป' }, { status: 413 });
    return Response.json(executeCommand(JSON.parse(body)), { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    if (error instanceof InputError) return Response.json({ error: error.message }, { status: error.status });
    if (error instanceof SyntaxError) return Response.json({ error: 'รูปแบบ JSON ไม่ถูกต้อง' }, { status: 400 });
    console.error('Could not save queue command', error);
    return Response.json({ error: 'บันทึกไม่สำเร็จ กรุณาลองอีกครั้ง' }, { status: 500 });
  }
}
