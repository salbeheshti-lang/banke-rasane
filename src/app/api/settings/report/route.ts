import { NextRequest, NextResponse } from 'next/server';
import { getApiBaseForRequest } from '@/lib/server-auth';

export const runtime = 'nodejs';

async function forward(request: NextRequest, method: 'GET' | 'POST') {
  const apiBase = getApiBaseForRequest(request);
  const authorization = request.headers.get('Authorization');
  if (!authorization) return NextResponse.json({ ok: false, error: 'احراز هویت لازم است' }, { status: 401 });
  if (!apiBase) return NextResponse.json({ ok: false, error: 'سرور انتخاب‌شده در فهرست سرورهای مجاز نیست' }, { status: 403 });

  try {
    const body = method === 'POST' ? JSON.stringify(await request.json()) : undefined;
    const response = await fetch(apiBase + '/api/settings/report', {
      method,
      headers: {
        Authorization: authorization,
        ...(body ? { 'Content-Type': 'application/json' } : {}),
      },
      body,
      cache: 'no-store',
      signal: AbortSignal.timeout(10_000),
    });
    const payload = await response.text();
    return new NextResponse(payload, {
      status: response.status,
      headers: {
        'Content-Type': response.headers.get('Content-Type') || 'application/json; charset=utf-8',
        'Cache-Control': 'private, no-store',
      },
    });
  } catch (error) {
    return NextResponse.json({ ok: false, error: 'ارتباط با سرور انتخاب‌شده برقرار نشد' }, { status: 502 });
  }
}

export async function GET(request: NextRequest) {
  return forward(request, 'GET');
}

export async function POST(request: NextRequest) {
  return forward(request, 'POST');
}
