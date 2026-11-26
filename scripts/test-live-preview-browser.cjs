/* eslint @typescript-eslint/no-require-imports: off */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('@playwright/test');

const baseURL = (process.env.WORKER_URL || 'https://bankresaneh-visual-preview.bankresaneh.workers.dev').replace(/\/$/, '');
const artifactDir = path.join(process.cwd(), 'artifacts', 'live-preview');
fs.mkdirSync(artifactDir, { recursive: true });
const diagnostics = { url: baseURL, failedRequests: [], badResponses: [], consoleErrors: [], pageErrors: [], runtime: null };
let browser;

(async () => {
  try {
    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({ serviceWorkers: 'block' });
    // Always test a first-visit user. A stale localStorage token must not hide
    // the login screen behind an auth request to a sleeping free API.
    await context.addInitScript(() => {
      localStorage.removeItem('bankresaneh_token');
      localStorage.removeItem('server_url');
    });
    const page = await context.newPage();
    page.setDefaultTimeout(20_000);
    page.on('requestfailed', request => diagnostics.failedRequests.push({
      url: request.url(), error: request.failure()?.errorText || 'request failed',
    }));
    page.on('response', response => {
      if (response.status() >= 400) diagnostics.badResponses.push({ url: response.url(), status: response.status() });
    });
    page.on('console', message => {
      if (message.type() === 'error') diagnostics.consoleErrors.push(message.text());
    });
    page.on('pageerror', error => diagnostics.pageErrors.push(error.message));

    const response = await page.goto(baseURL + '/', { waitUntil: 'domcontentloaded', timeout: 90_000 });
    assert.ok(response && response.ok(), 'Live Worker root navigation must return HTTP 2xx');

    // This is the state the previous check missed: the app must remove its
    // auth splash and render the actual interactive login form.
    await page.getByText('در حال بارگذاری...', { exact: true }).waitFor({ state: 'detached', timeout: 25_000 });
    const username = page.locator('#login-username');
    const password = page.locator('#login-password');
    await username.waitFor({ state: 'visible', timeout: 10_000 });
    await password.waitFor({ state: 'visible', timeout: 10_000 });
    await page.getByRole('button', { name: /ورود/ }).waitFor({ state: 'visible', timeout: 10_000 });

    // Prove React hydration and controlled input events, without submitting
    // credentials or touching the authentication endpoint.
    await username.fill('preview-interaction-check');
    assert.equal(await username.inputValue(), 'preview-interaction-check', 'Username input must accept controlled React updates');
    await password.fill('preview-password-check');
    const showPassword = page.getByRole('button', { name: /نمایش رمز/ });
    await showPassword.click();
    assert.equal(await password.getAttribute('type'), 'text', 'Show-password control must update React state');
    await page.getByRole('button', { name: /پنهان کردن رمز/ }).click();
    assert.equal(await password.getAttribute('type'), 'password', 'Hide-password control must update React state');

    diagnostics.runtime = await page.evaluate(() => ({
      title: document.title,
      readyState: document.readyState,
      loginForm: Boolean(document.querySelector('#login-username') && document.querySelector('#login-password')),
      loadingSplashVisible: [...document.querySelectorAll('span')].some(el => el.textContent?.trim() === 'در حال بارگذاری...'),
      scriptCount: [...document.scripts].filter(script => script.src).length,
      usernameValue: document.querySelector('#login-username')?.value,
      passwordToggleType: document.querySelector('#login-password')?.type,
    }));
    assert.equal(diagnostics.runtime.loadingSplashVisible, false, 'Auth loading splash must be gone');
    assert.ok(diagnostics.runtime.scriptCount > 0, 'Compiled JavaScript chunks must be present');
    assert.deepEqual(diagnostics.pageErrors, [], 'No uncaught browser runtime errors');
    assert.deepEqual(diagnostics.consoleErrors, [], 'No browser console errors');
    assert.deepEqual(diagnostics.failedRequests, [], 'No failed browser requests');
    assert.deepEqual(diagnostics.badResponses, [], 'No HTTP error responses');

    await page.screenshot({ path: path.join(artifactDir, 'preview-browser.png'), fullPage: true });
    diagnostics.result = 'PASS';
    console.log(JSON.stringify(diagnostics, null, 2));
    fs.writeFileSync(path.join(artifactDir, 'diagnostics.json'), JSON.stringify(diagnostics, null, 2));
    await context.close();
  } catch (error) {
    diagnostics.result = 'FAIL';
    diagnostics.error = error.stack || error.message;
    if (browser) {
      try {
        const pages = browser.contexts().flatMap(context => context.pages());
        if (pages[0]) {
          diagnostics.dom = await pages[0].locator('body').innerText({ timeout: 3_000 }).catch(() => 'DOM unavailable');
          await pages[0].screenshot({ path: path.join(artifactDir, 'preview-browser-failure.png'), fullPage: true, timeout: 10_000 }).catch(() => {});
        }
      } catch {}
    }
    fs.writeFileSync(path.join(artifactDir, 'diagnostics.json'), JSON.stringify(diagnostics, null, 2));
    console.error(JSON.stringify(diagnostics, null, 2));
    throw error;
  } finally {
    if (browser) await browser.close();
  }
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
