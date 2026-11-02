import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export function GET(request: Request) {
  const expected = process.env.BANKRESANEH_STARTUP_TOKEN;
  const supplied = request.headers.get('x-bankresaneh-startup-token');
  if (!expected || supplied !== expected) {
    return new NextResponse(null, { status: 404 });
  }
  return NextResponse.json({ status: 'ready' });
}
