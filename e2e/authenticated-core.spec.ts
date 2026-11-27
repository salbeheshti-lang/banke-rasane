import { test, expect } from '@playwright/test';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import ffmpegPath from 'ffmpeg-static';

const API = 'http://127.0.0.1:3002';
const ADMIN_PASSWORD = 'SmokeTest!2026';
const FIXTURE_NUM = 987654;
const FIXTURE_NAME = 'BankResaneh Desktop Acceptance Fixture';

test('authenticated app shell, edit persistence, real PDF preview, and video trim flow', async ({ page, request }) => {
  test.setTimeout(240_000);
  // The E2E API starts with an isolated database and the documented loopback
  // bootstrap account. Complete its mandatory first-login password change,
  // then create one disposable record for the UI workflow.
  // Make retries safe: the first attempt may have changed the bootstrap password
  // or created the fixture before a later browser assertion failed.
  let loginPassword = ADMIN_PASSWORD;
  let firstLogin = await request.post(API + '/api/auth/login', {
    data: { username: 'admin', password: loginPassword },
  });
  if (!firstLogin.ok()) {
    loginPassword = 'admin';
    firstLogin = await request.post(API + '/api/auth/login', {
      data: { username: 'admin', password: loginPassword },
    });
  }
  expect(firstLogin.status()).toBe(200);
  const firstLoginData = await firstLogin.json();
  expect(firstLoginData.token).toBeTruthy();

  let token = firstLoginData.token;
  if (loginPassword === 'admin') {
    const changedPassword = await request.put(API + '/api/auth/change-password', {
      headers: { Authorization: 'Bearer ' + token },
      data: { oldPassword: 'admin', newPassword: ADMIN_PASSWORD },
    });
    expect(changedPassword.status()).toBe(200);
    token = (await changedPassword.json()).token;
  }
  expect(token).toBeTruthy();

  await request.delete(API + '/api/shows?num=' + FIXTURE_NUM, {
    headers: { Authorization: 'Bearer ' + token },
  });

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
  await expect(appFooter).toHaveCount(1);
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
  const fixtureHeading = page.getByRole('heading', { name: FIXTURE_NAME, exact: true });
  await expect(fixtureHeading).toBeVisible({ timeout: 30_000 });
  await fixtureHeading.click();
  await page.getByRole('button', { name: /ویرایش/ }).click();
  await expect(page.getByRole('heading', { name: 'ویرایش برنامه' })).toBeVisible();

  // FormField intentionally uses a visible label adjacent to its input.
  const nameInput = page.locator('label').filter({ hasText: 'نام برنامه *' }).locator('xpath=following-sibling::input');
  await expect(nameInput).toBeVisible();
  const editedName = FIXTURE_NAME + ' — ویرایش‌شده';
  await nameInput.fill(editedName);
  await page.getByRole('button', { name: /بروزرسانی/ }).click();
  const editedHeading = page.getByRole('heading', { name: editedName, exact: true });
  await expect(editedHeading).toBeVisible({ timeout: 30_000 });

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
  await editedHeading.click();
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

  // The details modal remains mounted underneath the PDF preview; close the topmost export modal.
  await page.locator('.modal-backdrop').last().getByRole('button').first().click();
  await expect(page.locator('iframe[title="پیش‌نمایش واقعی PDF گزارش"]')).toHaveCount(0);
  await page.getByRole('button', { name: /ویرایش/ }).click();
  await expect(page.getByRole('heading', { name: 'ویرایش برنامه' })).toBeVisible();

  // Generate a finite-duration, browser-decodable WebM with the same FFmpeg
  // binary used by the API. MediaRecorder WebM blobs may omit duration metadata,
  // which correctly leaves the editor's trim action disabled.
  if (!ffmpegPath) throw new Error('ffmpeg-static did not provide a platform binary.');
  const videoDir = mkdtempSync(join(tmpdir(), 'bankresaneh-e2e-video-'));
  const videoPath = join(videoDir, 'bankresaneh-e2e-clip.webm');
  const generated = spawnSync(ffmpegPath, [
    '-hide_banner', '-loglevel', 'error', '-y',
    '-f', 'lavfi', '-i', 'testsrc2=size=320x240:rate=24:duration=2',
    '-an', '-c:v', 'libvpx', '-deadline', 'realtime', '-cpu-used', '8',
    '-f', 'webm', videoPath,
  ], { encoding: 'utf8', timeout: 60_000 });
  expect(generated.status).toBe(0);
  const videoBuffer = readFileSync(videoPath);
  expect(videoBuffer.length).toBeGreaterThan(1_000);
  await page.locator('input[type="file"][accept*="video/mp4"]').setInputFiles({
    name: 'bankresaneh-e2e-clip.webm',
    mimeType: 'video/webm',
    buffer: videoBuffer,
  });
  rmSync(videoDir, { recursive: true, force: true });
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
  const videoUpdateResponsePromise = page.waitForResponse(
    response => response.url().includes('/api/shows/' + FIXTURE_NUM) && response.request().method() === 'PUT',
    { timeout: 60_000 },
  );
  await page.getByRole('button', { name: /بروزرسانی/ }).click();
  const videoUpdateResponse = await videoUpdateResponsePromise;
  const videoUpdateBody = await videoUpdateResponse.text();
  expect(videoUpdateResponse.status(), videoUpdateBody).toBe(200);
  await expect(page.getByRole('heading', { name: editedName, exact: true })).toBeVisible({ timeout: 30_000 });

  const persistedVideo = await request.get(
    API + '/api/shows/search?q=' + encodeURIComponent(editedName),
    { headers: { Authorization: 'Bearer ' + token } },
  );
  expect(persistedVideo.status()).toBe(200);
  const persistedVideoData = await persistedVideo.json();
  const videoShow = persistedVideoData.shows?.find((show: { num: number }) => Number(show.num) === FIXTURE_NUM);
  expect(videoShow?.videos?.some((url: string) => url.startsWith('data:video/mp4;base64,'))).toBeTruthy();
});
