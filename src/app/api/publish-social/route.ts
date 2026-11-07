import { NextRequest, NextResponse } from 'next/server';
import { gatePermission } from '@/lib/server-auth';

export const runtime = 'nodejs';

// Both Telegram and Bale expose a Telegram-shaped Bot API:
//   Telegram: https://api.telegram.org/bot<TOKEN>/<method>
//   Bale:     https://tapi.bale.ai/bot<TOKEN>/<method>
const API_BASE: Record<string, string> = {
  telegram: 'https://api.telegram.org',
  bale: 'https://tapi.bale.ai',
};

interface PublishBody {
  platform: 'telegram' | 'bale';
  token: string;
  chatId: string;
  text: string;
  imageUrl?: string; // optional URL of an image to attach (sendPhoto)
}

export async function POST(request: NextRequest) {
  // --- Auth: requires export_reports permission (admin/editor by default).
  // Previously this endpoint was unauthenticated, which let anyone supply
  // an arbitrary bot token + chatId and use this server as an anonymous
  // spam relay. The token+chatId are still caller-supplied (per the
  // existing bot-config feature), but now only authorized users can hit
  // the endpoint at all. ---
  const gate = await gatePermission(request, 'export_reports');
  if (!gate.ok) {
    return NextResponse.json({ ok: false, error: gate.status === 401 ? 'احراز هویت لازم است' : 'دسترسی غیرمجاز — نیاز به دسترسی گزارش‌گیری' }, { status: gate.status });
  }
  const user = gate.user;
  try {
    const body = (await request.json()) as PublishBody & { verify?: boolean };
    const { platform, token, chatId, text, imageUrl } = body;

    // Basic validation — never echo the token back in errors.
    if (!platform || !API_BASE[platform]) {
      return NextResponse.json({ ok: false, error: 'پلتفرم نامعتبر است' }, { status: 400 });
    }
    if (!token || !/^[0-9]+:[A-Za-z0-9_-]{20,}$/.test(token)) {
      return NextResponse.json({ ok: false, error: 'توکن ربات نامعتبر است' }, { status: 400 });
    }

    // VERIFY MODE: if body.verify is true, just check the bot token is valid
    // via getMe (no message sent). This replaces the old unauthenticated GET
    // endpoint that accepted the token via query string.
    if (body.verify === true) {
      const res = await fetch(`${API_BASE[platform]}/bot${token}/getMe`);
      const data = await res.json();
      if (!data.ok) {
        return NextResponse.json({ ok: false, error: data.description || 'توکن نامعتبر' }, { status: 502 });
      }
      return NextResponse.json({
        ok: true,
        bot: { id: data.result.id, username: data.result.username, first_name: data.result.first_name },
      });
    }

    if (!chatId) {
      return NextResponse.json({ ok: false, error: 'شناسهٔ مقصد (Chat ID) الزامی است' }, { status: 400 });
    }
    if (!text && !imageUrl) {
      return NextResponse.json({ ok: false, error: 'متن یا تصویر پست الزامی است' }, { status: 400 });
    }

    const base = API_BASE[platform];
    const trimmedText = (text || '').slice(0, 4096); // API limit per message

    // If we have an image URL, send it as a photo with caption (text up to 1024 chars).
    // Otherwise send a plain text message.
    if (imageUrl) {
      const cap = trimmedText.slice(0, 1024);
      const tgRes = await fetch(`${base}/bot${token}/sendPhoto`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          photo: imageUrl,
          caption: cap,
          parse_mode: 'HTML',
        }),
      });
      const tgData = await tgRes.json();
      if (!tgData.ok) {
        return NextResponse.json(
          { ok: false, error: tgData.description || 'ارسال تصویر ناموفق بود' },
          { status: 502 }
        );
      }
      return NextResponse.json({ ok: true, method: 'sendPhoto', messageId: tgData.result?.message_id });
    }

    const tgRes = await fetch(`${base}/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: trimmedText,
        parse_mode: 'HTML',
      }),
    });
    const tgData = await tgRes.json();
    if (!tgData.ok) {
      return NextResponse.json(
        { ok: false, error: tgData.description || 'ارسال پیام ناموفق بود' },
        { status: 502 }
      );
    }
    return NextResponse.json({ ok: true, method: 'sendMessage', messageId: tgData.result?.message_id });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: 'خطای سرور هنگام ارسال' },
      { status: 500 }
    );
  }
}

// NOTE: the original GET handler (which accepted the bot token via query
// string) is intentionally REMOVED. The frontend now uses POST with a
// JSON body for bot verification (see handleVerifyBot in page.tsx).
// This eliminates the token-in-URL leak vector (tokens in URLs get
// logged by proxies, server access logs, and browser history).
//
// If a GET is still needed in the future, it should:
//   1. Require authentication (requirePermission).
//   2. NOT accept the token via query string — use a header or POST body.
