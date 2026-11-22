import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type RouteContext = {
  params: Promise<{ path: string[] }>;
};

const FORWARDED_REQUEST_HEADERS = [
  'accept',
  'authorization',
  'content-type',
  'if-match',
  'if-none-match',
  'range',
  'user-agent',
] as const;

const HOP_BY_HOP_RESPONSE_HEADERS = new Set([
  'connection',
  'content-encoding',
  'content-length',
  'keep-alive',
  'proxy-authenticate',
  'proxy-authorization',
  'te',
  'trailer',
  'transfer-encoding',
  'upgrade',
]);

async function proxy(request: NextRequest, context: RouteContext): Promise<Response> {
  const apiBase = process.env.BANKRESANEH_API_BASE?.trim();
  if (!apiBase) {
    return NextResponse.json(
      { error: 'Preview API is not configured on the server' },
      { status: 503 },
    );
  }

  const { path } = await context.params;
  const incomingUrl = new URL(request.url);
  const upstreamUrl = new URL(
    path.map((segment) => encodeURIComponent(segment)).join('/') + incomingUrl.search,
    apiBase.replace(/\/+$/, '') + '/',
  );

  const headers = new Headers();
  for (const name of FORWARDED_REQUEST_HEADERS) {
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
    const upstream = await fetch(upstreamUrl, init);
    const responseHeaders = new Headers();
    upstream.headers.forEach((value, name) => {
      if (!HOP_BY_HOP_RESPONSE_HEADERS.has(name.toLowerCase())) {
        responseHeaders.set(name, value);
      }
    });

    return new Response(upstream.body, {
      status: upstream.status,
      statusText: upstream.statusText,
      headers: responseHeaders,
    });
  } catch (error) {
    console.error('[preview-api-proxy] upstream request failed', error);
    return NextResponse.json(
      { error: 'Preview API is temporarily unavailable' },
      { status: 502 },
    );
  }
}

export const GET = proxy;
export const HEAD = proxy;
export const POST = proxy;
export const PUT = proxy;
export const PATCH = proxy;
export const DELETE = proxy;
export const OPTIONS = proxy;
