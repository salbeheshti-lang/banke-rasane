/* eslint @typescript-eslint/no-require-imports: off, @typescript-eslint/no-unused-expressions: off */
/* Full acceptance test against the installed Windows Electron app.
 * The caller launches the executable separately so this script can attach
 * through Chromium DevTools Protocol and exercise the actual packaged UI.
 */
const { chromium, expect } = require('@playwright/test');
const { spawn, spawnSync, execFileSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const ffmpegPath = require('ffmpeg-static');

const API = 'http://127.0.0.1:3002';
const DEVTOOLS = 'http://127.0.0.1:9229';
const ADMIN_PASSWORD = 'SmokeTest!2026';
const FIXTURE_NUM = 987651;
const FIXTURE_NAME = 'BankResaneh Installed Desktop Acceptance Fixture';
const ORG_LABEL = 'مانیتورینگ مرکز طرح و برنامه سیما';

async function apiRequest(pathname, method = 'GET', body, token) {
  const headers = {};
  if (token) headers.Authorization = 'Bearer ' + token;
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  const response = await fetch(API + pathname, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await response.json().catch(() => ({}));
  return { response, data };
}

async function waitForPage() {
  const deadline = Date.now() + 90_000;
  let lastError = 'DevTools page not ready';
  while (Date.now() < deadline) {
    try {
      const response = await fetch(DEVTOOLS + '/json/list');
      if (response.ok) {
        const targets = await response.json();
        if (targets.some(target => target.type === 'page' && target.webSocketDebuggerUrl)) return;
      }
      lastError = 'DevTools returned HTTP ' + response.status;
    } catch (error) {
      lastError = error.message;
    }
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  throw new Error('Installed Electron DevTools did not become ready: ' + lastError);
}

async function run() {
  let browser;
  let token;
  let fixtureCreated = false;
  let videoDir;
  let child;
  try {
    const executable = path.resolve(process.env.BANKRESANEH_EXE || process.argv[2] || path.resolve(__dirname, '..', 'release', 'win-unpacked', 'BankResaneh.exe'));
    child = spawn(executable, ['--disable-gpu', '--no-sandbox', '--remote-debugging-port=9229'], {
      stdio: 'ignore',
      windowsHide: false,
      env: { ...process.env, ELECTRON_DISABLE_SECURITY_WARNINGS: 'true' },
    });
    child.on('error', error => process.stderr.write('Electron spawn error: ' + error.message + '\\n'));
    const startupDeadline = Date.now() + 90_000;
    let uiReady = false;
    let apiReady = false;
    while (Date.now() < startupDeadline && (!uiReady || !apiReady)) {
      if (child.exitCode !== null) throw new Error('Installed Electron exited during startup with code ' + child.exitCode);
      if (!uiReady) { try { const response = await fetch('http://127.0.0.1:3000/'); uiReady = response.ok; } catch {} }
      if (!apiReady) { try { const response = await fetch(API + '/api/health'); if (response.ok) { const health = await response.json(); apiReady = Number(health.showsCount) > 0; } } catch {} }
      if (!uiReady || !apiReady) await new Promise(resolve => setTimeout(resolve, 500));
    }
    if (!uiReady || !apiReady) throw new Error('Installed Electron UI/API did not become ready before acceptance testing.');
    const firstLogin = await apiRequest('/api/auth/login', 'POST', {
      username: 'admin',
      password: ADMIN_PASSWORD,
    });
    let loginData = firstLogin.data;
    if (!firstLogin.response.ok) {
      const bootstrapLogin = await apiRequest('/api/auth/login', 'POST', {
        username: 'admin',
        password: 'admin',
      });
      if (!bootstrapLogin.response.ok || !bootstrapLogin.data.token) {
        throw new Error('Could not authenticate the isolated Windows runner admin account: ' + JSON.stringify(bootstrapLogin.data));
      }
      const changed = await apiRequest('/api/auth/change-password', 'PUT', {
        oldPassword: 'admin',
        newPassword: ADMIN_PASSWORD,
      }, bootstrapLogin.data.token);
      if (!changed.response.ok || !changed.data.token) {
        throw new Error('Could not initialize the Windows runner admin password: ' + JSON.stringify(changed.data));
      }
      loginData = changed.data;
    }
    token = loginData.token;
    if (!token) throw new Error('Admin login did not return a session token.');

    await apiRequest('/api/shows?num=' + FIXTURE_NUM, 'DELETE', undefined, token);
    const created = await apiRequest('/api/shows', 'POST', {
      num: FIXTURE_NUM,
      name: FIXTURE_NAME,
      category: 'گفتگو',
      source: 'آزمون نصب واقعی ویندوز',
      summary: 'رکورد آزمایشی برای بررسی نسخهٔ نصب‌شده',
      descriptionFa: 'این برنامه فقط برای آزمون پذیرش نصب‌کننده ایجاد شده است.',
      videos: [],
      images: [],
      tags: [],
      decorIncluded: false,
    }, token);
    if (!created.response.ok) throw new Error('Could not create desktop acceptance fixture: ' + JSON.stringify(created.data));
    fixtureCreated = true;

    await waitForPage();
    browser = await chromium.connectOverCDP(DEVTOOLS);
    const context = browser.contexts()[0];
    if (!context) throw new Error('Electron did not expose a browser context through DevTools.');
    const page = context.pages()[0] || await context.newPage();

    await expect(page.locator('#login-username')).toBeVisible({ timeout: 30_000 });
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.locator('#login-username').fill('admin');
    await page.locator('#login-password').fill(ADMIN_PASSWORD);
    await page.getByRole('button', { name: /ورود/ }).click();

    const footer = page.locator('[data-testid="app-brand-footer"]');
    await expect(footer).toHaveCount(1);
    await expect(footer).toBeVisible({ timeout: 30_000 });
    await expect(footer.getByRole('img', { name: ORG_LABEL })).toBeVisible();
    await expect(page.locator('header img[alt="' + ORG_LABEL + '"]')).toBeVisible();

    await page.setViewportSize({ width: 390, height: 844 });
    await expect(page.locator('[data-testid="header-organization-brand"] img[alt="' + ORG_LABEL + '"]')).toBeVisible();
    await expect(page.locator('[data-testid="mobile-bottom-nav"]')).toBeVisible();
    await expect(footer.getByText(ORG_LABEL)).toBeVisible();

    await page.getByRole('button', { name: 'برنامه‌ها', exact: true }).click();
    const fixtureHeading = page.getByRole('heading', { name: FIXTURE_NAME, exact: true });
    await expect(fixtureHeading).toBeVisible({ timeout: 30_000 });
    await fixtureHeading.click();
    await page.getByRole('button', { name: /ویرایش/ }).click();
    await expect(page.getByRole('heading', { name: 'ویرایش برنامه' })).toBeVisible();

    const nameInput = page.locator('label').filter({ hasText: 'نام برنامه *' }).locator('xpath=following-sibling::input');
    const editedName = FIXTURE_NAME + ' — ویرایش‌شده';
    await nameInput.fill(editedName);
    const editResponsePromise = page.waitForResponse(
      response => response.url().includes('/api/shows/' + FIXTURE_NUM) && response.request().method() === 'PUT',
      { timeout: 60_000 },
    );
    await page.getByRole('button', { name: /بروزرسانی/ }).click();
    const editResponse = await editResponsePromise;
    if (editResponse.status() !== 200) throw new Error('Installed app edit failed: HTTP ' + editResponse.status() + ' ' + await editResponse.text());
    const editedHeading = page.getByRole('heading', { name: editedName, exact: true });
    await expect(editedHeading).toBeVisible({ timeout: 30_000 });

    await editedHeading.click();
    const pdfResponsePromise = page.waitForResponse(
      response => response.url().includes('/api/export-pdf-file') && response.request().method() === 'POST',
      { timeout: 90_000 },
    );
    await page.getByRole('button', { name: /گزارش PDF/ }).click();
    const pdfResponse = await pdfResponsePromise;
    if (pdfResponse.status() !== 200) throw new Error('Installed app PDF export failed: HTTP ' + pdfResponse.status());
    if (!String(pdfResponse.headers()['content-type'] || '').includes('application/pdf')) {
      throw new Error('Installed app PDF route did not return application/pdf.');
    }
    const pdfBytes = await pdfResponse.body();
    if (pdfBytes.subarray(0, 4).toString() !== '%PDF' || pdfBytes.length < 1000) {
      throw new Error('Installed app PDF response is not a valid non-empty PDF.');
    }
    await expect(page.locator('iframe[title="پیش‌نمایش واقعی PDF گزارش"]')).toBeVisible();
    await page.locator('.modal-backdrop').last().getByRole('button').first().click();
    await expect(page.locator('iframe[title="پیش‌نمایش واقعی PDF گزارش"]')).toHaveCount(0);
    await page.getByRole('button', { name: /ویرایش/ }).click();

    if (!ffmpegPath) throw new Error('ffmpeg-static did not provide a Windows binary.');
    videoDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bankresaneh-installed-video-'));
    const videoPath = path.join(videoDir, 'installed-acceptance-clip.webm');
    const generated = spawnSync(ffmpegPath, [
      '-hide_banner', '-loglevel', 'error', '-y',
      '-f', 'lavfi', '-i', 'testsrc2=size=320x240:rate=24:duration=2',
      '-an', '-c:v', 'libvpx', '-deadline', 'realtime', '-cpu-used', '8',
      '-f', 'webm', videoPath,
    ], { encoding: 'utf8', timeout: 60_000 });
    if (generated.status !== 0) throw new Error('Could not create WebM test clip: ' + (generated.stderr || generated.error || 'unknown FFmpeg error'));
    const videoBuffer = fs.readFileSync(videoPath);
    await page.locator('input[type="file"][accept*="video/mp4"]').setInputFiles({
      name: 'installed-acceptance-clip.webm',
      mimeType: 'video/webm',
      buffer: videoBuffer,
    });
    fs.rmSync(videoDir, { recursive: true, force: true });
    videoDir = undefined;
    await expect(page.getByText(/مدت اصلی/)).toBeVisible({ timeout: 30_000 });
    await expect(page.getByRole('button', { name: 'پردازش و پیش‌نمایش' })).toBeEnabled({ timeout: 30_000 });

    const transcodeResponsePromise = page.waitForResponse(
      response => response.url().includes('/api/video/transcode') && response.request().method() === 'POST',
      { timeout: 120_000 },
    );
    await page.getByRole('button', { name: 'پردازش و پیش‌نمایش' }).click();
    const transcodeResponse = await transcodeResponsePromise;
    if (transcodeResponse.status() !== 200) throw new Error('Installed app video transcode failed: HTTP ' + transcodeResponse.status() + ' ' + await transcodeResponse.text());
    const transcodeData = await transcodeResponse.json();
    if (!/^data:video\/mp4;base64,/.test(transcodeData.dataUrl || '')) {
      throw new Error('Installed app video transcode did not return a Base64 MP4.');
    }
    await expect(page.getByText('پیش‌نمایش خروجی نهایی')).toBeVisible({ timeout: 30_000 });
    await page.getByRole('button', { name: 'تأیید و افزودن خروجی به برنامه' }).click();

    const videoSavePromise = page.waitForResponse(
      response => response.url().includes('/api/shows/' + FIXTURE_NUM) && response.request().method() === 'PUT',
      { timeout: 60_000 },
    );
    await page.getByRole('button', { name: /بروزرسانی/ }).click();
    const videoSave = await videoSavePromise;
    if (videoSave.status() !== 200) throw new Error('Installed app could not persist the edited MP4: HTTP ' + videoSave.status() + ' ' + await videoSave.text());

    const persisted = await apiRequest('/api/shows/search?q=' + encodeURIComponent(editedName), 'GET', undefined, token);
    const savedShow = persisted.data.shows?.find(show => Number(show.num) === FIXTURE_NUM);
    if (!savedShow || !savedShow.videos?.some(url => url.startsWith('data:video/mp4;base64,'))) {
      throw new Error('Installed app video clip was not persisted in the local archive database.');
    }

    process.stdout.write('PASS: installed Electron UI verified organization header/footer on desktop and mobile, edit persistence, genuine PDF preview, MP4 trim/transcode, and video persistence.\n');
  } finally {
    if (videoDir && fs.existsSync(videoDir)) fs.rmSync(videoDir, { recursive: true, force: true });
    if (fixtureCreated && token) {
      try { await apiRequest('/api/shows?num=' + FIXTURE_NUM, 'DELETE', undefined, token); }
      catch (error) { process.stderr.write('Could not clean desktop acceptance fixture: ' + error.message + '\n'); }
    }
    if (browser) {
      try { await browser.close(); } catch {}
    }
    if (child?.pid) {
      try { execFileSync('taskkill', ['/PID', String(child.pid), '/T', '/F'], { stdio: 'ignore', timeout: 10_000 }); }
      catch (error) { process.stderr.write('Could not stop installed Electron process tree: ' + error.message + '\\n'); try { child.kill(); } catch {} }
    }
  }
}

run().catch(error => {
  process.stderr.write((error.stack || error.message) + '\n');
  process.exitCode = 1;
});
