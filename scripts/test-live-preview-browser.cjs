/* eslint @typescript-eslint/no-require-imports: off */
const assert = require('node:assert/strict');
const { chromium } = require('@playwright/test');

const baseURL = (process.env.WORKER_URL || 'https://bankresaneh-visual-preview.bankresaneh.workers.dev').replace(/\/$/, '');
const failedJs = [];
const badJsResponses = [];
const pageErrors = [];

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();
  page.setDefaultTimeout(45_000);
  page.on('requestfailed', request => {
    if (/\.m?js(?:\?|$)/i.test(request.url())) failedJs.push({ url: request.url(), error: request.failure()?.errorText || 'request failed' });
  });
  page.on('response', response => {
    if (/\.m?js(?:\?|$)/i.test(response.url()) && response.status() >= 400) badJsResponses.push({ url: response.url(), status: response.status() });
  });
  page.on('pageerror', error => pageErrors.push(error.message));

  try {
    const response = await page.goto(baseURL + '/', { waitUntil: 'domcontentloaded', timeout: 90_000 });
    assert.ok(response && response.ok(), 'Live Worker root navigation must return HTTP 2xx');
    await page.getByLabel('نام کاربری').waitFor({ state: 'visible', timeout: 60_000 });
    await page.getByLabel('رمز عبور').waitFor({ state: 'visible', timeout: 15_000 });
    await page.getByRole('button', { name: /ورود/ }).waitFor({ state: 'visible', timeout: 15_000 });
    await page.waitForTimeout(5_000);

    const scripts = await page.locator('script[src]').evaluateAll(nodes => nodes.map(node => node.src));
    assert.ok(scripts.length > 0, 'The live app must reference compiled JavaScript chunks');
    assert.deepEqual(failedJs, [], 'No JavaScript chunk request may fail');
    assert.deepEqual(badJsResponses, [], 'No JavaScript chunk may return an HTTP error');
    assert.deepEqual(pageErrors, [], 'The live login page must not throw uncaught JavaScript errors');

    const state = await page.evaluate(() => ({
      title: document.title,
      serviceWorkerController: Boolean(navigator.serviceWorker?.controller),
      scripts: [...document.scripts].filter(script => script.src).length,
      loginInputs: [...document.querySelectorAll('input')].length,
    }));
    console.log(JSON.stringify({ result: 'PASS', url: baseURL, state, scripts, failedJs, badJsResponses, pageErrors }, null, 2));
  } catch (error) {
    console.error(JSON.stringify({ result: 'FAIL', url: baseURL, error: error.message, failedJs, badJsResponses, pageErrors }, null, 2));
    throw error;
  } finally {
    await context.close();
    await browser.close();
  }
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
