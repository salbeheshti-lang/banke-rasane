import { NextRequest } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const API_BASE = (
  process.env.BANKRESANEH_API_BASE ||
  process.env.NEXT_PUBLIC_BANKRESANEH_API_BASE ||
  'http://127.0.0.1:3002'
).replace(/\/+$/, '');

async function proxy(request: NextRequest): Promise<Response> {
  const headers = new Headers();
  for (const name of ['accept', 'authorization', 'content-type']) {
    const value = request.headers.get(name);
    if (value) headers.set(name, value);
  }

  const init: RequestInit = {
    method: request.method,
    headers,
    cache: 'no-store',
    redirect: 'manual',
  };
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    init.body = await request.arrayBuffer();
  }

  try {
    const upstream = await fetch(`${API_BASE}/api/settings/logo`, init);
    const responseHeaders = new Headers();
    upstream.headers.forEach((value, name) => {
      if (!['connection', 'content-encoding', 'content-length', 'transfer-encoding'].includes(name.toLowerCase())) {
        responseHeaders.set(name, value);
      }
    });
    return new Response(upstream.body, {
      status: upstream.status,
      statusText: upstream.statusText,
      headers: responseHeaders,
    });
  } catch (error) {
    console.error('[logo-proxy] API request failed:', error);
    return Response.json({ ok: false, error: 'سرویس لوگو در دسترس نیست' }, { status: 502 });
  }
}

export const GET = proxy;
export const POST = proxy;
