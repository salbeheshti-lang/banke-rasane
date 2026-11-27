import { NextRequest, NextResponse } from 'next/server';
import { getCloudflareContext } from '@opennextjs/cloudflare';

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
  // Wrangler vars are runtime Worker bindings. Read them from the active
  // Cloudflare request context instead of relying on build-time process.env.
  let apiBase: string | undefined;
  try {
    const cloudflareEnv = getCloudflareContext().env as {
      BANKRESANEH_API_BASE?: string;
    };
    apiBase = cloudflareEnv.BANKRESANEH_API_BASE?.trim();
  } catch (error) {
    // Keep local Node.js development working outside the Workers runtime.
    apiBase = process.env.BANKRESANEH_API_BASE?.trim();
    if (!apiBase) {
      console.error('[preview-api-proxy] Cloudflare runtime context unavailable', error);
    }
  }

  if (!apiBase) {
    console.error('[preview-api-proxy] BANKRESANEH_API_BASE is missing at runtime');
    return NextResponse.json(
      { error: 'Preview API is not configured on the server' },
      { status: 503 },
    );
  }

  const { path } = await context.params;
  const incomingUrl = new URL(request.url);
  const upstreamUrl = new URL(
    'api/' + path.map((segment) => encodeURIComponent(segment)).join('/') + incomingUrl.search,
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
    const detail = error instanceof Error
      ? { name: error.name, message: error.message, cause: String(error.cause ?? '') }
      : { error: String(error) };
    console.error('[preview-api-proxy] upstream fetch failed', {
      origin: upstreamUrl.origin,
      path: upstreamUrl.pathname,
      ...detail,
    });
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
