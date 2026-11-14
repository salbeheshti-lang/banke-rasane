import { test, expect } from '@playwright/test';

test('PWA manifest exposes Persian install metadata and existing app icons', async ({ page, request }) => {
  await page.goto('/');
  await expect(page).toHaveTitle(/بانک رسانه/);

  const manifestResponse = await request.get('/manifest.webmanifest');
  expect(manifestResponse.ok()).toBeTruthy();
  const manifest = await manifestResponse.json();
  expect(manifest.name).toBe('بانک رسانه');
  expect(manifest.lang).toBe('fa');
  expect(manifest.dir).toBe('rtl');
  expect(manifest.display).toBe('standalone');
  expect(manifest.icons.length).toBeGreaterThanOrEqual(2);

  for (const icon of manifest.icons) {
    const response = await request.get(icon.src);
    expect(response.ok()).toBeTruthy();
    expect(response.headers()['content-type']).toContain('image/png');
  }
});

test('service worker and offline fallback are served, and private APIs are excluded from cache logic', async ({ page, request }) => {
  await page.goto('/');
  const swResponse = await request.get('/sw.js');
  expect(swResponse.ok()).toBeTruthy();
  const swSource = await swResponse.text();
  expect(swSource).toContain("url.pathname.startsWith('/api/')");
  expect(swSource).toContain("url.pathname.startsWith('/login')");
  expect(swSource).toContain('OFFLINE_URL');

  const offlineResponse = await request.get('/offline.html');
  expect(offlineResponse.ok()).toBeTruthy();
  expect(await offlineResponse.text()).toContain('اتصال به سرور برقرار نیست');

  await expect.poll(async () => page.evaluate(async () => {
    const registration = await navigator.serviceWorker.getRegistration('/');
    return Boolean(registration?.active || registration?.installing || registration?.waiting);
  }), { timeout: 15_000 }).toBeTruthy();
});

test('login screen shows accessible fields and enforces the 3-minute lockout countdown', async ({ page }) => {
  await page.clock.install();
  await page.route('http://127.0.0.1:3002/api/auth/login', async (route) => {
    await route.fulfill({
      status: 429,
      contentType: 'application/json',
      body: JSON.stringify({ error: 'به دلیل تلاش‌های ناموفق، ورود تا 180 ثانیه دیگر قفل است' }),
    });
  });

  await page.goto('/');
  const username = page.getByLabel('نام کاربری');
  const password = page.getByLabel('رمز عبور');
  await expect(username).toBeVisible();
  await expect(password).toBeVisible();
  await username.fill('browser-test');
  await password.fill('incorrect-password');
  await page.getByRole('button', { name: /ورود/ }).click();

  await expect(page.getByText(/زمان باقی‌مانده: 03:00/)).toBeVisible();
  await expect(username).toBeDisabled();
  await expect(password).toBeDisabled();
  await expect(page.getByRole('button', { name: /03:00/ })).toBeDisabled();

  await page.clock.fastForward(1_000);
  await expect(page.getByText(/زمان باقی‌مانده: 02:59/)).toBeVisible();

  await page.clock.runFor(179_000);
  await expect(username).toBeEnabled();
  await expect(password).toBeEnabled();
  await expect(page.getByRole('button', { name: /ورود/ })).toBeEnabled();
  await expect(page.getByText(/زمان باقی‌مانده/)).toHaveCount(0);
});
