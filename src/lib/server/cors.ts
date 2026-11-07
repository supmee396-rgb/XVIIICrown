const configuredOrigin = (process.env.ALLOWED_ORIGIN || '').replace(/\/$/, '');

export function isAllowedOrigin(request: Request) {
  const origin = request.headers.get('origin');
  if (!origin) return true;
  try {
    if (new URL(origin).host === request.headers.get('host')) return true;
  } catch {
    return false;
  }
  return Boolean(configuredOrigin && origin.replace(/\/$/, '') === configuredOrigin);
}

export function corsHeaders(request: Request, headers?: HeadersInit) {
  const result = new Headers(headers);
  const origin = request.headers.get('origin');
  if (origin && configuredOrigin && origin.replace(/\/$/, '') === configuredOrigin) {
    result.set('Access-Control-Allow-Origin', origin);
    result.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    result.set('Access-Control-Allow-Headers', 'Content-Type');
    result.set('Vary', 'Origin');
  }
  return result;
}
