import { NextRequest, NextResponse } from 'next/server';
import { getApiBaseForRequest } from '@/lib/server-auth';

export const runtime = 'nodejs';
export const maxDuration = 45;

/**
 * Forward image normalization to the selected Bun API service.
 * This route intentionally shares the public /api/import-image URL with the
 * legacy UI entry point, so it must proxy rather than return the old 410
 * compatibility response. Sharp stays on the API host, never in Workers.
 */
export async function POST(request: NextRequest) {
  const apiBase = getApiBaseForRequest(request);
  if (!apiBase) {
    return NextResponse.json({ error: 'سرور API انتخاب‌شده مجاز نیست' }, { status: 403 });
  }

  const headers = new Headers();
  const authorization = request.headers.get('authorization');
  const contentType = request.headers.get('content-type');
  if (authorization) headers.set('authorization', authorization);
  if (contentType) headers.set('content-type', contentType);

  try {
    const upstream = await fetch(apiBase.replace(/\\/+$/, '') + '/api/import-image', {
      method: 'POST',
      headers,
      body: await request.arrayBuffer(),
      cache: 'no-store',
      redirect: 'manual',
      signal: AbortSignal.timeout(40_000),
    });
    const responseHeaders = new Headers({
      'content-type': upstream.headers.get('content-type') || 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      'x-content-type-options': 'nosniff',
    });
    return new NextResponse(await upstream.arrayBuffer(), {
      status: upstream.status,
      headers: responseHeaders,
    });
  } catch (error) {
    const timedOut = error instanceof Error && error.name === 'TimeoutError';
    return NextResponse.json(
      { error: timedOut ? 'دریافت و بهینه‌سازی تصویر بیش از حد طول کشید؛ دوباره تلاش کنید' : 'ارتباط با سرویس دریافت تصویر برقرار نشد' },
      { status: timedOut ? 504 : 502 },
    );
  }
}
