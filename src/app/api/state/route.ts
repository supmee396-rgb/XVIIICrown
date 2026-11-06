import { readSnapshot } from '@/lib/server/store';
import { executeCommand, InputError } from '@/lib/server/actions';
import { corsHeaders, isAllowedOrigin } from '@/lib/server/cors';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try { return Response.json(readSnapshot(), { headers: corsHeaders(request, { 'Cache-Control': 'no-store' }) }); }
  catch (error) {
    console.error('Could not read queue database', error);
    return Response.json({ error: 'อ่านข้อมูลไม่สำเร็จ กรุณาลองอีกครั้ง' }, { status: 500, headers: corsHeaders(request) });
  }
}

export async function OPTIONS(request: Request) {
  if (!isAllowedOrigin(request)) return new Response(null, { status: 403 });
  return new Response(null, { status: 204, headers: corsHeaders(request) });
}

export async function POST(request: Request) {
  if (!isAllowedOrigin(request)) {
    return Response.json({ error: 'ไม่อนุญาตคำขอจากเว็บไซต์อื่น' }, { status: 403, headers: corsHeaders(request) });
  }
  if (!request.headers.get('content-type')?.startsWith('application/json')) {
    return Response.json({ error: 'ต้องส่งข้อมูลแบบ JSON' }, { status: 415, headers: corsHeaders(request) });
  }
  try {
    const body = await request.text();
    if (body.length > 8192) return Response.json({ error: 'ข้อมูลมีขนาดใหญ่เกินไป' }, { status: 413, headers: corsHeaders(request) });
    return Response.json(executeCommand(JSON.parse(body)), { headers: corsHeaders(request, { 'Cache-Control': 'no-store' }) });
  } catch (error) {
    if (error instanceof InputError) return Response.json({ error: error.message }, { status: error.status, headers: corsHeaders(request) });
    if (error instanceof SyntaxError) return Response.json({ error: 'รูปแบบ JSON ไม่ถูกต้อง' }, { status: 400, headers: corsHeaders(request) });
    console.error('Could not save queue command', error);
    return Response.json({ error: 'บันทึกไม่สำเร็จ กรุณาลองอีกครั้ง' }, { status: 500, headers: corsHeaders(request) });
  }
}
