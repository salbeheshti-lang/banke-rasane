/* eslint @typescript-eslint/no-require-imports: off */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('@playwright/test');

const baseURL = (process.env.WORKER_URL || 'https://bankresaneh-visual-preview.bankresaneh.workers.dev').replace(/\/$/, '');
const artifactDir = path.join(process.cwd(), 'artifacts', 'live-preview');
fs.mkdirSync(artifactDir, { recursive: true });
const diagnostics = {
  url: baseURL,
  failedRequests: [],
  badResponses: [],
  consoleErrors: [],
  pageErrors: [],
  javascriptResponses: [],
  serviceWorkerEvents: [],
  runtime: null,
};
let browser;

(async () => {
  try {
    browser = await chromium.launch({ headless: true });
    // Do not block Service Workers: the previous test did, which excluded the
    // exact browser execution path implicated by the user's blank-screen issue.
    const context = await browser.newContext({ serviceWorkers: 'allow' });
    await context.addInitScript(() => {
      localStorage.removeItem('bankresaneh_token');
      localStorage.removeItem('server_url');
    });

    const page = await context.newPage();
    page.setDefaultTimeout(25_000);
    page.on('requestfailed', request => diagnostics.failedRequests.push({
      url: request.url(),
      resourceType: request.resourceType(),
      error: request.failure()?.errorText || 'request failed',
    }));
    page.on('response', response => {
      const request = response.request();
      if (response.status() >= 400) {
        diagnostics.badResponses.push({ url: response.url(), status: response.status(), resourceType: request.resourceType() });
      }
      if (request.resourceType() === 'script') {
        diagnostics.javascriptResponses.push({ url: response.url(), status: response.status() });
      }
    });
    page.on('console', message => {
      if (message.type() === 'error') diagnostics.consoleErrors.push(message.text());
    });
    page.on('pageerror', error => diagnostics.pageErrors.push(error.message));
    context.on('serviceworker', worker => diagnostics.serviceWorkerEvents.push({
      url: worker.url(),
      event: 'created',
    }));

    const response = await page.goto(baseURL + '/', { waitUntil: 'domcontentloaded', timeout: 90_000 });
    assert.ok(response && response.ok(), 'Live Worker root navigation must return HTTP 2xx');

    // Wait for the site's own registration to activate, then reload once so
    // this document is controlled by the real deployed Service Worker.
    const registration = await page.evaluate(async () => {
      if (!('serviceWorker' in navigator)) return { supported: false };
      const ready = await Promise.race([
        navigator.serviceWorker.ready,
        new Promise((_, reject) => setTimeout(() => reject(new Error('Service Worker activation timed out')), 20_000)),
      ]);
      return {
        supported: true,
        scope: ready.scope,
        activeScriptURL: ready.active?.scriptURL || null,
        state: ready.active?.state || null,
      };
    });
    diagnostics.serviceWorker = registration;
    assert.equal(registration.supported, true, 'Chromium must support Service Workers');
    assert.ok(registration.activeScriptURL?.endsWith('/sw.js'), 'The deployed /sw.js must activate');

    await page.reload({ waitUntil: 'domcontentloaded', timeout: 90_000 });
    const controlled = await page.evaluate(() => Boolean(navigator.serviceWorker.controller));
    diagnostics.serviceWorker.controlledAfterReload = controlled;
    assert.equal(controlled, true, 'The reloaded page must be controlled by the deployed Service Worker');

    // Verify the real login UI after hydration with Service Worker enabled.
    await page.getByText('در حال بارگذاری...', { exact: true }).waitFor({ state: 'detached', timeout: 30_000 });
    const username = page.locator('#login-username');
    const password = page.locator('#login-password');
    await username.waitFor({ state: 'visible', timeout: 15_000 });
    await password.waitFor({ state: 'visible', timeout: 15_000 });
    await page.getByRole('button', { name: /ورود/ }).waitFor({ state: 'visible', timeout: 15_000 });

    // Prove React hydration and controlled input events without submitting credentials.
    await username.fill('preview-interaction-check');
    assert.equal(await username.inputValue(), 'preview-interaction-check');
    await password.fill('preview-password-check');
    await page.getByRole('button', { name: /نمایش رمز/ }).click();
    assert.equal(await password.getAttribute('type'), 'text');
    await page.getByRole('button', { name: /پنهان کردن رمز/ }).click();
    assert.equal(await password.getAttribute('type'), 'password');

    diagnostics.runtime = await page.evaluate(() => ({
      title: document.title,
      readyState: document.readyState,
      loginForm: Boolean(document.querySelector('#login-username') && document.querySelector('#login-password')),
      loadingSplashVisible: [...document.querySelectorAll('span')].some(el => el.textContent?.trim() === 'در حال بارگذاری...'),
      scriptCount: [...document.scripts].filter(script => script.src).length,
      usernameValue: document.querySelector('#login-username')?.value,
      passwordToggleType: document.querySelector('#login-password')?.type,
      serviceWorkerController: navigator.serviceWorker.controller?.scriptURL || null,
    }));
    assert.equal(diagnostics.runtime.loadingSplashVisible, false, 'Auth loading splash must be gone');
    assert.ok(diagnostics.runtime.scriptCount > 0, 'Compiled JavaScript chunks must be present');
    assert.ok(diagnostics.javascriptResponses.length > 0, 'Browser must request compiled JavaScript');
    assert.ok(diagnostics.javascriptResponses.every(item => item.status >= 200 && item.status < 300), 'Every JavaScript chunk must load successfully');
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
          diagnostics.currentURL = pages[0].url();
          diagnostics.pendingRequests = await pages[0].evaluate(() => performance.getEntriesByType('resource')
            .filter(entry => entry.responseEnd === 0)
            .map(entry => ({ name: entry.name, initiatorType: entry.initiatorType }))).catch(() => []);
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
