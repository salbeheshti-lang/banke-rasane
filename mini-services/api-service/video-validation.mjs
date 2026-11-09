// Validation shared by the local API and its Node/Bun tests.
export const MAX_VIDEO_CLIP_BYTES = 8 * 1024 * 1024;
export const MAX_TOTAL_VIDEO_CLIP_BYTES = 40 * 1024 * 1024;
export const MAX_LOCAL_VIDEO_CLIPS = 5;
export const MAX_VIDEO_ENTRIES = 100;
export const MAX_VIDEO_REFERENCE_LENGTH = 4096;

function decodedBase64Bytes(value) {
  const padding = value.endsWith('==') ? 2 : value.endsWith('=') ? 1 : 0;
  return Math.max(0, Math.floor(value.length * 3 / 4) - padding);
}

export function validateShowVideos(videos) {
  if (videos == null) return { valid: true };
  if (!Array.isArray(videos)) {
    return { valid: false, error: 'فهرست ویدیوها معتبر نیست.' };
  }
  if (videos.length > MAX_VIDEO_ENTRIES) {
    return { valid: false, error: 'تعداد ویدیوهای برنامه بیش از حد مجاز است.' };
  }

  let localClipCount = 0;
  let totalClipBytes = 0;
  for (const reference of videos) {
    if (typeof reference !== 'string' || reference.length === 0 ||
        reference.length > MAX_VIDEO_REFERENCE_LENGTH) {
      return { valid: false, error: 'یکی از نشانی‌های ویدیو معتبر نیست یا بیش از حد طولانی است.' };
    }

    if (!reference.startsWith('data:')) continue;
    const match = reference.match(/^data:(video\/[a-z0-9.+-]+);base64,([a-z0-9+/]*={0,2})$/i);
    if (!match || match[2].length % 4 !== 0) {
      return { valid: false, error: 'فایل ویدیویی بارگذاری‌شده باید یک ویدیوی Base64 معتبر باشد.' };
    }

    const bytes = decodedBase64Bytes(match[2]);
    if (bytes <= 0 || bytes > MAX_VIDEO_CLIP_BYTES) {
      return { valid: false, error: 'حجم هر کلیپ ویدیویی باید حداکثر ۸ مگابایت باشد.' };
    }
    localClipCount += 1;
    totalClipBytes += bytes;
    if (localClipCount > MAX_LOCAL_VIDEO_CLIPS) {
      return { valid: false, error: 'حداکثر ۵ کلیپ ویدیویی بارگذاری‌شده برای هر برنامه مجاز است.' };
    }
    if (totalClipBytes > MAX_TOTAL_VIDEO_CLIP_BYTES) {
      return { valid: false, error: 'مجموع حجم کلیپ‌های بارگذاری‌شده نباید بیشتر از ۴۰ مگابایت باشد.' };
    }
  }
  return { valid: true, localClipCount, totalClipBytes };
}
