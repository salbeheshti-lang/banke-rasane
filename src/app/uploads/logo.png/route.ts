export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const API_BASE = (
  process.env.BANKRESANEH_API_BASE ||
  process.env.NEXT_PUBLIC_BANKRESANEH_API_BASE ||
  'http://127.0.0.1:3002'
).replace(/\/+$/, '');

export async function GET(): Promise<Response> {
  try {
    const upstream = await fetch(`${API_BASE}/api/settings/logo`, {
      method: 'GET',
      cache: 'no-store',
    });
    if (!upstream.ok) return new Response(null, { status: upstream.status });
    return new Response(upstream.body, {
      status: 200,
      headers: {
        'Content-Type': upstream.headers.get('content-type') || 'image/png',
        'Cache-Control': 'no-store',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch (error) {
    console.error('[logo-asset-proxy] API request failed:', error);
    return new Response(null, { status: 502 });
  }
}
