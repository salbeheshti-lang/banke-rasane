import { NextResponse } from 'next/server';

// Image import and Sharp processing run on the configured Bun API service.
// Keeping this compatibility response avoids loading native Sharp inside a
// Cloudflare Worker, where native child-process modules are unavailable.
export async function POST() {
  return NextResponse.json(
    { error: 'این مسیر به API انتخاب‌شده منتقل شده است؛ از /api/import-image در سرور برنامه استفاده کنید.' },
    { status: 410 },
  );
}
