import { NextRequest, NextResponse } from 'next/server';

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
  try {
    const body = (await request.json()) as PublishBody;
    const { platform, token, chatId, text, imageUrl } = body;

    // Basic validation — never echo the token back in errors.
    if (!platform || !API_BASE[platform]) {
      return NextResponse.json({ ok: false, error: 'پلتفرم نامعتبر است' }, { status: 400 });
    }
    if (!token || !/^[0-9]+:[A-Za-z0-9_-]{20,}$/.test(token)) {
      return NextResponse.json({ ok: false, error: 'توکن ربات نامعتبر است' }, { status: 400 });
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

// Lightweight GET used by the "ارسال تست" button to verify the bot token + chatId
// without sending a full post. Returns minimal info about the bot.
export async function GET(request: NextRequest) {
  const platform = request.nextUrl.searchParams.get('platform') as 'telegram' | 'bale' | null;
  const token = request.nextUrl.searchParams.get('token');
  if (!platform || !API_BASE[platform] || !token) {
    return NextResponse.json({ ok: false, error: 'پارامتر ناقص' }, { status: 400 });
  }
  try {
    const res = await fetch(`${API_BASE[platform]}/bot${token}/getMe`);
    const data = await res.json();
    if (!data.ok) {
      return NextResponse.json({ ok: false, error: data.description || 'توکن نامعتبر' }, { status: 502 });
    }
    return NextResponse.json({
      ok: true,
      bot: { id: data.result.id, username: data.result.username, first_name: data.result.first_name },
    });
  } catch {
    return NextResponse.json({ ok: false, error: 'اتصال به سرور پلتفرم ناموفق بود' }, { status: 502 });
  }
}
