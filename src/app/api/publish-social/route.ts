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

function isDirectMp4Url(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password && /\\.mp4$/i.test(url.pathname);
  } catch {
    return false;
  }
}

interface PublishBody {
  platform: 'telegram' | 'bale';
  token: string;
  chatId: string;
  text: string;
  imageUrl?: string; // remote URL or optimized data URL for a program image
  videoUrl?: string; // direct HTTPS MP4/WebM URL OR a video data URL from the clip editor
}

function isDirectVideoUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password && /\.(mp4|webm)$/i.test(url.pathname);
  } catch {
    return false;
  }
}

function parseImageDataUrl(value: string): { mime: string; bytes: Buffer; extension: string } | null {
  const match = value.match(/^data:(image\/(?:jpeg|png|webp|gif|avif));base64,([A-Za-z0-9+/=\r\n]+)$/i);
  if (!match) return null;
  const mime = match[1].toLowerCase();
  const bytes = Buffer.from(match[2], 'base64');
  if (!bytes.length || bytes.length > 5 * 1024 * 1024) return null;
  const extension = mime === 'image/jpeg' ? 'jpg' : mime.split('/')[1];
  return { mime, bytes, extension };
}

// Accept video clips exported by the in-browser editor (WebM via MediaRecorder)
// as well as MP4 data URLs. Telegram and Bale both accept WebM uploads.
function parseVideoDataUrl(value: string): { mime: string; bytes: Buffer; extension: string } | null {
  const match = value.match(/^data:(video\/(?:mp4|webm|ogg));base64,([A-Za-z0-9+/=\r\n]+)$/i);
  if (!match) return null;
  const mime = match[1].toLowerCase();
  const bytes = Buffer.from(match[2], 'base64');
  if (!bytes.length || bytes.length > 50 * 1024 * 1024) return null;
  const extension = mime === 'video/mp4' ? 'mp4' : mime === 'video/webm' ? 'webm' : 'ogv';
  return { mime, bytes, extension };
}

export async function POST(request: NextRequest) {
  // Bot credentials and direct publishing are restricted to administrators.
  // Editors may export reports, but must never be able to submit or verify
  // a Bale/Telegram bot token through this endpoint.
  const gate = await gatePermission(request, 'manage_settings');
  if (!gate.ok) {
    return NextResponse.json({ ok: false, error: gate.status === 401 ? 'احراز هویت لازم است' : 'دسترسی غیرمجاز — مدیریت ربات انتشار فقط برای مدیران مجاز است' }, { status: gate.status });
  }
  // A configurable permission alone is not sufficient here: only an actual
  // administrator or the designated super-admin may handle bot credentials.
  if (gate.user.role !== 'admin' && !gate.user.isSuperAdmin) {
    return NextResponse.json(
      { ok: false, error: 'دسترسی غیرمجاز — فقط مدیران می‌توانند تنظیمات ربات انتشار را مدیریت کنند' },
      { status: 403 }
    );
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
      const res = await fetch(`${API_BASE[platform]}/bot${token}/getMe`, { signal: AbortSignal.timeout(15000) });
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
    if (!text && !imageUrl && !body.videoUrl) {
      return NextResponse.json({ ok: false, error: 'متن، تصویر یا ویدئوی پست الزامی است' }, { status: 400 });
    }

    const base = API_BASE[platform];
    const rawText = typeof text === 'string' ? text : '';
    if (rawText.length > 4096) {
      return NextResponse.json({ ok: false, error: 'متن پست بیشتر از سقف ۴۰۹۶ نویسه است؛ متن را کوتاه کنید تا هیچ بخشی حذف نشود' }, { status: 400 });
    }
    const hasVideo = typeof body.videoUrl === 'string' && body.videoUrl.length > 0;
    // Early guard: accept either a data:video/ URL (clip from the in-browser
    // editor) or a direct HTTPS .mp4/.webm URL. Reject page links (YouTube,
    // Aparat, etc.) up front with a clear message. The deeper byte-level
    // validation happens later via parseVideoDataUrl / isDirectVideoUrl.
    if (hasVideo && !body.videoUrl!.startsWith('data:video/') && !isDirectVideoUrl(body.videoUrl!)) {
      return NextResponse.json({ ok: false, error: 'ویدئو باید یک لینک مستقیم HTTPS به فایل MP4/WebM یا فایل ویدئویی ذخیره‌شده (data URL) باشد؛ لینک صفحهٔ یوتیوب/آپارات قابل ارسال مستقیم نیست' }, { status: 400 });
    }
    const hasImage = typeof imageUrl === 'string' && imageUrl.length > 0;
    let imageData: ReturnType<typeof parseImageDataUrl> = null;
    if (hasImage) {
      if (imageUrl!.startsWith('data:')) {
        imageData = parseImageDataUrl(imageUrl!);
        if (!imageData) {
          return NextResponse.json({ ok: false, error: 'تصویر ذخیره‌شده معتبر نیست یا حجم آن از ۵ مگابایت بیشتر است' }, { status: 400 });
        }
      } else {
        try {
          const parsedImage = new URL(imageUrl!);
          if (parsedImage.protocol !== 'https:' || parsedImage.username || parsedImage.password) throw new Error('invalid');
        } catch {
          return NextResponse.json({ ok: false, error: 'لینک تصویر باید HTTPS معتبر یا تصویر ذخیره‌شدهٔ داخلی باشد' }, { status: 400 });
        }
      }
    }

    if (imageData) {
      const sharp = (await import('sharp')).default;
      const jpeg = await sharp(imageData.bytes).rotate().jpeg({ quality: 88 }).toBuffer();
      if (!jpeg.length || jpeg.length > 5 * 1024 * 1024) {
        return NextResponse.json({ ok: false, error: 'حجم تصویر برای ارسال به ربات بیش از حد مجاز است' }, { status: 413 });
      }
      imageData = { mime: 'image/jpeg', bytes: jpeg, extension: 'jpg' };
    }

    const hasMedia = hasVideo || hasImage;
    if (hasMedia && rawText.length > 1024) {
      return NextResponse.json({ ok: false, error: 'سقف کپشن رسانه ۱۰۲۴ نویسه است؛ متن را در پیش‌نمایش کوتاه کنید تا هیچ بخشی بی‌صدا حذف نشود' }, { status: 400 });
    }
    const caption = rawText;

    // When both real program video and image exist, publish one ordered album:
    // video first (with the full caption), then the real program image.
    // This uses sendMediaGroup; it never splits the caption into a separate message.
    if (hasVideo && hasImage) {
      // Parse the video early so we know whether it is an uploadable data URL
      // (clip from the editor) or a remote HTTPS URL.
      const videoData = body.videoUrl!.startsWith('data:video/') ? parseVideoDataUrl(body.videoUrl!) : null;
      const videoRemote = !videoData && isDirectVideoUrl(body.videoUrl!) ? body.videoUrl : null;
      const videoMediaRef = videoData ? 'attach://program_clip' : videoRemote;
      const photoMediaRef = imageData ? 'attach://program_cover' : imageUrl;
      const media = [
        { type: 'video', media: videoMediaRef, ...(caption ? { caption } : {}) },
        { type: 'photo', media: photoMediaRef },
      ];
      let tgRes: Response;
      if (imageData || videoData) {
        const form = new FormData();
        form.set('chat_id', chatId);
        form.set('media', JSON.stringify(media));
        if (videoData) {
          form.set('program_clip', new Blob([videoData.bytes.buffer.slice(videoData.bytes.byteOffset, videoData.bytes.byteOffset + videoData.bytes.byteLength) as ArrayBuffer], { type: videoData.mime }), `program-clip.${videoData.extension}`);
        }
        if (imageData) {
          form.set('program_cover', new Blob([imageData.bytes.buffer.slice(imageData.bytes.byteOffset, imageData.bytes.byteOffset + imageData.bytes.byteLength) as ArrayBuffer], { type: imageData.mime }), `program-cover.${imageData.extension}`);
        }
        tgRes = await fetch(`${base}/bot${token}/sendMediaGroup`, {
          method: 'POST',
          body: form,
          signal: AbortSignal.timeout(120000),
        });
      } else {
        tgRes = await fetch(`${base}/bot${token}/sendMediaGroup`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ chat_id: chatId, media }),
          signal: AbortSignal.timeout(120000),
        });
      }
      const tgData = await tgRes.json().catch(() => ({}));
      if (!tgData.ok) {
        return NextResponse.json({ ok: false, error: tgData.description || 'ارسال آلبوم ویدئو و تصویر ناموفق بود؛ هیچ پیام جداگانه‌ای ارسال نشد' }, { status: 502 });
      }
      return NextResponse.json({
        ok: true,
        method: 'sendMediaGroup',
        messageIds: Array.isArray(tgData.result) ? tgData.result.map((item: any) => item.message_id) : [],
      });
    }

    if (hasVideo) {
      const videoDataUrl = body.videoUrl && body.videoUrl.startsWith('data:video/') ? parseVideoDataUrl(body.videoUrl) : null;
      const videoRemoteUrl = body.videoUrl && isDirectVideoUrl(body.videoUrl) ? body.videoUrl : null;
      if (!videoDataUrl && !videoRemoteUrl) {
        return NextResponse.json({ ok: false, error: 'ویدئو باید یک لینک مستقیم HTTPS به فایل MP4/WebM یا یک فایل data URL معتبر باشد.' }, { status: 400 });
      }
      let tgRes: Response;
      if (videoDataUrl) {
        // Upload the clip bytes directly (supports WebM from the editor + MP4).
        const form = new FormData();
        form.set('chat_id', chatId);
        form.set('video', new Blob([videoDataUrl.bytes.buffer.slice(videoDataUrl.bytes.byteOffset, videoDataUrl.bytes.byteOffset + videoDataUrl.bytes.byteLength) as ArrayBuffer], { type: videoDataUrl.mime }), `program-clip.${videoDataUrl.extension}`);
        if (caption) form.set('caption', caption);
        tgRes = await fetch(`${base}/bot${token}/sendVideo`, {
          method: 'POST',
          body: form,
          signal: AbortSignal.timeout(120000),
        });
      } else {
        tgRes = await fetch(`${base}/bot${token}/sendVideo`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ chat_id: chatId, video: videoRemoteUrl, ...(caption ? { caption } : {}) }),
          signal: AbortSignal.timeout(120000),
        });
      }
      const tgData = await tgRes.json().catch(() => ({}));
      if (!tgData.ok) {
        return NextResponse.json({ ok: false, error: tgData.description || 'ارسال ویدئو ناموفق بود' }, { status: 502 });
      }
      return NextResponse.json({ ok: true, method: 'sendVideo', messageId: tgData.result?.message_id });
    }

    if (hasImage) {
      let tgRes: Response;
      if (imageData) {
        const form = new FormData();
        form.set('chat_id', chatId);
        form.set('photo', new Blob([imageData.bytes.buffer.slice(imageData.bytes.byteOffset, imageData.bytes.byteOffset + imageData.bytes.byteLength) as ArrayBuffer], { type: imageData.mime }), `program-image.${imageData.extension}`);
        if (caption) form.set('caption', caption);
        tgRes = await fetch(`${base}/bot${token}/sendPhoto`, {
          method: 'POST',
          body: form,
          signal: AbortSignal.timeout(60000),
        });
      } else {
        tgRes = await fetch(`${base}/bot${token}/sendPhoto`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ chat_id: chatId, photo: imageUrl, ...(caption ? { caption } : {}) }),
          signal: AbortSignal.timeout(60000),
        });
      }
      const tgData = await tgRes.json().catch(() => ({}));
      if (!tgData.ok) {
        return NextResponse.json({ ok: false, error: tgData.description || 'ارسال تصویر ناموفق بود' }, { status: 502 });
      }
      return NextResponse.json({ ok: true, method: 'sendPhoto', messageId: tgData.result?.message_id });
    }

    const tgRes = await fetch(`${base}/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text: rawText }),
      signal: AbortSignal.timeout(20000),
    });
    const tgData = await tgRes.json().catch(() => ({}));
    if (!tgData.ok) {
      return NextResponse.json({ ok: false, error: tgData.description || 'ارسال پیام ناموفق بود' }, { status: 502 });
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
