import { NextRequest, NextResponse } from 'next/server';
import { getApiBaseForRequest } from '@/lib/server-auth';

export const runtime = 'nodejs';

async function selectedBackend(request: NextRequest) {
  const apiBase = getApiBaseForRequest(request);
  const authorization = request.headers.get('Authorization');
  if (!authorization) {
    return { error: NextResponse.json({ ok: false, error: 'احراز هویت لازم است' }, { status: 401 }) };
  }
  if (!apiBase) {
    return { error: NextResponse.json({ ok: false, error: 'سرور انتخاب‌شده در فهرست سرورهای مجاز نیست' }, { status: 403 }) };
  }
  return { apiBase, authorization };
}

export async function GET(request: NextRequest) {
  const selected = await selectedBackend(request);
  if (selected.error) return selected.error;
  try {
    const response = await fetch(selected.apiBase + '/api/settings/logo', {
      headers: { Authorization: selected.authorization },
      cache: 'no-store',
      signal: AbortSignal.timeout(10_000),
    });
    const headers = new Headers();
    for (const name of ['Content-Type', 'Content-Length', 'Content-Disposition']) {
      const value = response.headers.get(name);
      if (value) headers.set(name, value);
    }
    headers.set('Cache-Control', 'private, no-store, max-age=0');
    headers.set('X-Content-Type-Options', 'nosniff');
    return new NextResponse(await response.arrayBuffer(), { status: response.status, headers });
  } catch {
    return NextResponse.json({ ok: false, error: 'ارتباط با سرور انتخاب‌شده برقرار نشد' }, { status: 502 });
  }
}

export async function POST(request: NextRequest) {
  const selected = await selectedBackend(request);
  if (selected.error) return selected.error;
  try {
    const incoming = await request.formData();
    const file = incoming.get('file');
    if (!(file instanceof File)) {
      return NextResponse.json({ ok: false, error: 'فایلی ارسال نشده است' }, { status: 400 });
    }
    const outgoing = new FormData();
    outgoing.append('file', file, file.name || 'report-logo');
    const response = await fetch(selected.apiBase + '/api/settings/logo', {
      method: 'POST',
      headers: { Authorization: selected.authorization },
      body: outgoing,
      cache: 'no-store',
      signal: AbortSignal.timeout(20_000),
    });
    const payload = await response.text();
    return new NextResponse(payload, {
      status: response.status,
      headers: {
        'Content-Type': response.headers.get('Content-Type') || 'application/json; charset=utf-8',
        'Cache-Control': 'private, no-store',
      },
    });
  } catch {
    return NextResponse.json({ ok: false, error: 'بارگذاری لوگو روی سرور انتخاب‌شده ناموفق بود' }, { status: 502 });
  }
}
