// Validation shared by the local API and its Node/Bun tests.
export const MAX_VIDEO_CLIP_BYTES = 8 * 1024 * 1024;
export const MAX_TOTAL_VIDEO_CLIP_BYTES = 40 * 1024 * 1024;
export const MAX_LOCAL_VIDEO_CLIPS = 5;
export const MAX_VIDEO_ENTRIES = 100;
export const MAX_VIDEO_REFERENCE_LENGTH = 4096;

function parseDataVideo(reference) {
  const match = reference.match(/^data:(video\/[a-z0-9.+-]+);base64,([a-z0-9+/]*={0,2})$/i);
  if (!match || match[2].length % 4 !== 0) return null;
  const encoded = match[2];
  const padding = encoded.endsWith('==') ? 2 : encoded.endsWith('=') ? 1 : 0;
  const bytes = Math.max(0, Math.floor(encoded.length * 3 / 4) - padding);
  return bytes > 0 ? { bytes } : null;
}

export function validateShowVideos(videos, previousVideos = []) {
  if (videos == null) return { valid: true };
  if (!Array.isArray(videos)) {
    return { valid: false, error: 'فهرست ویدیوها معتبر نیست.' };
  }
  const previous = Array.isArray(previousVideos) ? previousVideos : [];
  // Do not make an unrelated edit impossible just because an older record
  // already contains more clips than the new upload policy permits.
  if (videos.length > MAX_VIDEO_ENTRIES && videos.length > previous.length) {
    return { valid: false, error: 'تعداد نشانی‌های ویدیوی برنامه بیش از حد مجاز است.' };
  }

  const previousCounts = new Map();
  for (const reference of previous) {
    previousCounts.set(reference, (previousCounts.get(reference) || 0) + 1);
  }

  let localClipCount = 0;
  let totalClipBytes = 0;
  let newLocalClipCount = 0;
  for (const reference of videos) {
    if (typeof reference !== 'string' || reference.length === 0) {
      return { valid: false, error: 'یکی از نشانی‌های ویدیو معتبر نیست.' };
    }

    const oldCount = previousCounts.get(reference) || 0;
    if (oldCount > 0) {
      previousCounts.set(reference, oldCount - 1);
      if (reference.startsWith('data:video/')) {
        localClipCount += 1;
        const existingClip = parseDataVideo(reference);
        if (existingClip) totalClipBytes += existingClip.bytes;
      }
      continue;
    }

    if (reference.length > MAX_VIDEO_REFERENCE_LENGTH) {
      return { valid: false, error: 'نشانی ویدیوی جدید بیش از حد طولانی است.' };
    }
    if (!reference.startsWith('data:')) continue;

    const clip = parseDataVideo(reference);
    if (!clip) {
      return { valid: false, error: 'فایل ویدیویی بارگذاری‌شده باید یک ویدیوی Base64 معتبر باشد.' };
    }
    if (clip.bytes > MAX_VIDEO_CLIP_BYTES) {
      return { valid: false, error: 'حجم هر کلیپ ویدیویی باید حداکثر ۸ مگابایت باشد.' };
    }
    localClipCount += 1;
    newLocalClipCount += 1;
    totalClipBytes += clip.bytes;
  }

  if (newLocalClipCount > 0 && localClipCount > MAX_LOCAL_VIDEO_CLIPS) {
    return { valid: false, error: 'حداکثر ۵ کلیپ ویدیویی بارگذاری‌شده برای هر برنامه مجاز است.' };
  }
  if (newLocalClipCount > 0 && totalClipBytes > MAX_TOTAL_VIDEO_CLIP_BYTES) {
    return { valid: false, error: 'مجموع حجم کلیپ‌های بارگذاری‌شده نباید بیشتر از ۴۰ مگابایت باشد.' };
  }
  return { valid: true, localClipCount, totalClipBytes };
}
