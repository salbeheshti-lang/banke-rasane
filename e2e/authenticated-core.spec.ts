import { test, expect } from '@playwright/test';

const API = 'http://127.0.0.1:3002';
const ADMIN_PASSWORD = 'SmokeTest!2026';
const FIXTURE_NUM = 987654;
const FIXTURE_NAME = 'BankResaneh Desktop Acceptance Fixture';

test('authenticated app shell, edit persistence, real PDF preview, and video trim flow', async ({ page, request }) => {
  // The E2E API starts with an isolated database and the documented loopback
  // bootstrap account. Complete its mandatory first-login password change,
  // then create one disposable record for the UI workflow.
  const firstLogin = await request.post(API + '/api/auth/login', {
    data: { username: 'admin', password: 'admin' },
  });
  expect(firstLogin.status()).toBe(200);
  const firstLoginData = await firstLogin.json();
  expect(firstLoginData.token).toBeTruthy();

  const changedPassword = await request.put(API + '/api/auth/change-password', {
    headers: { Authorization: 'Bearer ' + firstLoginData.token },
    data: { oldPassword: 'admin', newPassword: ADMIN_PASSWORD },
  });
  expect(changedPassword.status()).toBe(200);
  const token = (await changedPassword.json()).token;
  expect(token).toBeTruthy();

  const created = await request.post(API + '/api/shows', {
    headers: { Authorization: 'Bearer ' + token },
    data: {
      num: FIXTURE_NUM,
      name: FIXTURE_NAME,
      category: 'گفتگو',
      source: 'آزمون خودکار',
      summary: 'خلاصه اولیه برای آزمون ویرایش',
      descriptionFa: 'توضیحات اولیه برنامه آزمایشی',
      videos: [],
      images: [],
      tags: [],
      decorIncluded: false,
    },
  });
  expect(created.status()).toBe(200);

  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');
  await page.locator('#login-username').fill('admin');
  await page.locator('#login-password').fill(ADMIN_PASSWORD);
  await page.getByRole('button', { name: /ورود/ }).click();

  // Branding must be present in the authenticated shell, not only on login.
  const appFooter = page.locator('[data-testid="app-brand-footer"]');
  await expect(appFooter).toBeVisible({ timeout: 30_000 });
  await expect(appFooter.getByRole('img', { name: 'مانیتورینگ مرکز طرح و برنامه سیما' })).toBeVisible();
  await expect(page.locator('header img[alt="مانیتورینگ مرکز طرح و برنامه سیما"]')).toBeVisible();
  await expect(page.locator('[data-testid="mobile-bottom-nav"]')).toHaveCount(0);

  // Repeat the brand-shell check at a real mobile viewport.
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.locator('[data-testid="header-organization-brand"]')).toBeVisible();
  await expect(page.locator('[data-testid="header-organization-brand"] img[alt="مانیتورینگ مرکز طرح و برنامه سیما"]')).toBeVisible();
  await expect(appFooter).toBeVisible();
  await expect(page.locator('[data-testid="mobile-bottom-nav"]')).toBeVisible();
  await expect(appFooter.getByText('مانیتورینگ مرکز طرح و برنامه سیما')).toBeVisible();

  await page.getByRole('button', { name: 'برنامه‌ها', exact: true }).click();
  await expect(page.getByText(FIXTURE_NAME, { exact: true })).toBeVisible({ timeout: 30_000 });
  await page.getByText(FIXTURE_NAME, { exact: true }).first().click();
  await page.getByRole('button', { name: /ویرایش/ }).click();
  await expect(page.getByRole('heading', { name: 'ویرایش برنامه' })).toBeVisible();

  // FormField intentionally uses a visible label adjacent to its input.
  const nameInput = page.locator('label').filter({ hasText: 'نام برنامه *' }).locator('xpath=following-sibling::input');
  await expect(nameInput).toBeVisible();
  const editedName = FIXTURE_NAME + ' — ویرایش‌شده';
  await nameInput.fill(editedName);
  await page.getByRole('button', { name: /بروزرسانی/ }).click();
  await expect(page.getByText(editedName, { exact: true })).toBeVisible({ timeout: 30_000 });

  const persistedEdit = await request.get(
    API + '/api/shows/search?q=' + encodeURIComponent(editedName),
    { headers: { Authorization: 'Bearer ' + token } },
  );
  expect(persistedEdit.status()).toBe(200);
  const persistedEditData = await persistedEdit.json();
  const editedShow = persistedEditData.shows?.find((show: { num: number }) => Number(show.num) === FIXTURE_NUM);
  expect(editedShow?.name).toBe(editedName);

  // The same UI action must return a genuine binary PDF, not HTML or a
  // placeholder iframe. Check the response bytes and the rendered preview.
  await page.getByText(editedName, { exact: true }).first().click();
  const pdfResponsePromise = page.waitForResponse(
    response => response.url().includes('/api/export-pdf-file') && response.request().method() === 'POST',
    { timeout: 90_000 },
  );
  await page.getByRole('button', { name: /گزارش PDF/ }).click();
  const pdfResponse = await pdfResponsePromise;
  expect(pdfResponse.status()).toBe(200);
  expect(pdfResponse.headers()['content-type']).toContain('application/pdf');
  const pdfBytes = await pdfResponse.body();
  expect(pdfBytes.subarray(0, 4).toString()).toBe('%PDF');
  expect(pdfBytes.byteLength).toBeGreaterThan(1_000);
  await expect(page.locator('iframe[title="پیش‌نمایش واقعی PDF گزارش"]')).toBeVisible({ timeout: 30_000 });

  await page.keyboard.press('Escape');
  await page.getByText(editedName, { exact: true }).first().click();
  await page.getByRole('button', { name: /ویرایش/ }).click();
  await expect(page.getByRole('heading', { name: 'ویرایش برنامه' })).toBeVisible();

  // Generate a short, standards-compliant WebM in Chromium itself. The
  // product UI must decode it, build the filmstrip, transcode through the
  // packaged API's ffmpeg route, preview MP4, and persist the accepted clip.
  const generated = await page.evaluate(async () => {
    const canvas = document.createElement('canvas');
    canvas.width = 160;
    canvas.height = 90;
    const context = canvas.getContext('2d');
    if (!context || typeof MediaRecorder === 'undefined' || typeof canvas.captureStream !== 'function') {
      throw new Error('Browser does not support the required MediaRecorder test fixture.');
    }
    const mimeType = ['video/webm;codecs=vp8', 'video/webm'].find(type => MediaRecorder.isTypeSupported(type));
    if (!mimeType) throw new Error('No supported WebM recording codec is available.');
    const stream = canvas.captureStream(12);
    const recorder = new MediaRecorder(stream, { mimeType });
    const chunks: BlobPart[] = [];
    const finished = new Promise<Blob>(resolve => {
      recorder.ondataavailable = event => { if (event.data.size) chunks.push(event.data); };
      recorder.onstop = () => resolve(new Blob(chunks, { type: mimeType }));
    });
    let frame = 0;
    const draw = window.setInterval(() => {
      if (!context) return;
      context.fillStyle = 'rgb(' + (40 + frame * 7 % 180) + ',90,130)';
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.fillStyle = '#ffffff';
      context.font = '20px sans-serif';
      context.fillText('BankResaneh ' + frame, 12, 48);
      frame++;
    }, 80);
    recorder.start(100);
    await new Promise(resolve => window.setTimeout(resolve, 2_400));
    window.clearInterval(draw);
    recorder.stop();
    const blob = await finished;
    stream.getTracks().forEach(track => track.stop());
    const base64 = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result).split(',')[1] || '');
      reader.onerror = () => reject(new Error('Could not encode WebM test fixture.'));
      reader.readAsDataURL(blob);
    });
    return { base64, mimeType, size: blob.size };
  });
  expect(generated.size).toBeGreaterThan(1_000);
  await page.locator('input[type="file"][accept*="video/mp4"]').setInputFiles({
    name: 'bankresaneh-e2e-clip.webm',
    mimeType: 'video/webm',
    buffer: Buffer.from(generated.base64, 'base64'),
  });
  await expect(page.getByText(/مدت اصلی/)).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText(/نوار فریم‌های ویدیو/)).toBeVisible();
  await expect(page.getByRole('button', { name: 'پردازش و پیش‌نمایش' })).toBeEnabled({ timeout: 30_000 });

  const transcodePromise = page.waitForResponse(
    response => response.url().includes('/api/video/transcode') && response.request().method() === 'POST',
    { timeout: 120_000 },
  );
  await page.getByRole('button', { name: 'پردازش و پیش‌نمایش' }).click();
  const transcodeResponse = await transcodePromise;
  expect(transcodeResponse.status()).toBe(200);
  const transcodeData = await transcodeResponse.json();
  expect(transcodeData.dataUrl).toMatch(/^data:video\/mp4;base64,/);
  await expect(page.getByText('پیش‌نمایش خروجی نهایی')).toBeVisible({ timeout: 30_000 });
  await page.getByRole('button', { name: 'تأیید و افزودن خروجی به برنامه' }).click();
  await page.getByRole('button', { name: /بروزرسانی/ }).click();
  await expect(page.getByText(editedName, { exact: true })).toBeVisible({ timeout: 30_000 });

  const persistedVideo = await request.get(
    API + '/api/shows/search?q=' + encodeURIComponent(editedName),
    { headers: { Authorization: 'Bearer ' + token } },
  );
  expect(persistedVideo.status()).toBe(200);
  const persistedVideoData = await persistedVideo.json();
  const videoShow = persistedVideoData.shows?.find((show: { num: number }) => Number(show.num) === FIXTURE_NUM);
  expect(videoShow?.videos?.some((url: string) => url.startsWith('data:video/mp4;base64,'))).toBeTruthy();
});
