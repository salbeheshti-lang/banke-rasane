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
    const context = await browser.newContext({ serviceWorkers: 'block', viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    // Always test a first-visit user. A stale localStorage token must not hide
    // the login screen behind an auth request to a sleeping free API.
    await context.addInitScript(() => {
      localStorage.removeItem('bankresaneh_token');
      localStorage.removeItem('server_url');
      localStorage.removeItem('bankresaneh_lang');
      localStorage.removeItem('bankresaneh_theme');
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
    page.on('pageerror', error => diagnostics.pageErrors.push({ viewport: 'mobile', message: error.message, stack: error.stack }));

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

    // The live deployment must include the organization mark and exact official identity,
    // not merely the BankResaneh product logo.
    const organizationLogo = page.locator('footer img[alt="مانیتورینگ مرکز طرح و برنامه سیما"]');
    await organizationLogo.waitFor({ state: 'visible', timeout: 10_000 });
    assert.match(await organizationLogo.getAttribute('src'), /client-logo-white\.png$/, 'Login must render the official organization logo');
    assert.ok((await page.locator('footer').innerText()).includes('مانیتورینگ مرکز طرح و برنامه سیما'), 'Login footer must show the exact organization identity');
    const mobileLayout = await page.evaluate(() => {
      const logo = document.querySelector('footer img[alt="مانیتورینگ مرکز طرح و برنامه سیما"]');
      const text = [...document.querySelectorAll('footer span')].find(el => el.textContent?.includes('مانیتورینگ مرکز طرح و برنامه سیما'));
      return {
        viewportWidth: window.innerWidth,
        documentWidth: document.documentElement.scrollWidth,
        organizationLogoVisible: !!logo && logo.getBoundingClientRect().width > 0,
        organizationNameBelowLogo: !!logo && !!text && text.getBoundingClientRect().top >= logo.getBoundingClientRect().bottom - 2,
      };
    });
    assert.equal(mobileLayout.documentWidth, mobileLayout.viewportWidth, 'Mobile login must not overflow horizontally');
    assert.equal(mobileLayout.organizationLogoVisible, true, 'Organization logo must remain visible on mobile login');
    assert.equal(mobileLayout.organizationNameBelowLogo, true, 'Official organization name must be directly below its logo');

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

    // Desktop is a separate required target, not inferred from the mobile test.
    const desktopContext = await browser.newContext({
      serviceWorkers: 'block',
      viewport: { width: 1440, height: 900 },
      deviceScaleFactor: 1,
    });
    await desktopContext.addInitScript(() => {
      localStorage.removeItem('bankresaneh_token');
      localStorage.removeItem('server_url');
    });
    const desktopPage = await desktopContext.newPage();
    desktopPage.setDefaultTimeout(20_000);
    desktopPage.on('requestfailed', request => diagnostics.failedRequests.push({
      url: request.url(), error: request.failure()?.errorText || 'request failed',
    }));
    desktopPage.on('response', response => {
      if (response.status() >= 400) diagnostics.badResponses.push({ url: response.url(), status: response.status() });
    });
    desktopPage.on('console', message => {
      if (message.type() === 'error') diagnostics.consoleErrors.push(message.text());
    });
    desktopPage.on('pageerror', error => diagnostics.pageErrors.push({ viewport: 'desktop', message: error.message, stack: error.stack }));
    const desktopResponse = await desktopPage.goto(baseURL + '/', { waitUntil: 'domcontentloaded', timeout: 90_000 });
    assert.ok(desktopResponse && desktopResponse.ok(), 'Desktop Worker root navigation must return HTTP 2xx');
    await desktopPage.getByText('در حال بارگذاری...', { exact: true }).waitFor({ state: 'detached', timeout: 25_000 });
    await desktopPage.locator('#login-username').waitFor({ state: 'visible', timeout: 10_000 });
    await desktopPage.locator('#login-password').waitFor({ state: 'visible', timeout: 10_000 });
    const desktopLayout = await desktopPage.evaluate(() => {
      const logo = document.querySelector('footer img[alt="مانیتورینگ مرکز طرح و برنامه سیما"]');
      const text = [...document.querySelectorAll('footer span')].find(el => el.textContent?.includes('مانیتورینگ مرکز طرح و برنامه سیما'));
      return {
        viewportWidth: window.innerWidth,
        documentWidth: document.documentElement.scrollWidth,
        logoVisible: !!logo && logo.getBoundingClientRect().width > 0,
        organizationNameBelowLogo: !!logo && !!text && text.getBoundingClientRect().top >= logo.getBoundingClientRect().bottom - 2,
      };
    });
    assert.equal(desktopLayout.documentWidth, desktopLayout.viewportWidth, 'Desktop login must not overflow horizontally');
    assert.equal(desktopLayout.logoVisible, true, 'Organization logo must be visible on desktop');
    assert.equal(desktopLayout.organizationNameBelowLogo, true, 'Official organization name must be below the logo on desktop');
    await desktopPage.screenshot({ path: path.join(artifactDir, 'preview-browser-desktop.png'), fullPage: true });
    await desktopContext.close();

    // Returning users may have English saved in localStorage. Verify that this
    // preference is applied after hydration instead of changing the first
    // client render and causing React #418 on the deployed Worker.
    const languageContext = await browser.newContext({
      serviceWorkers: 'block',
      viewport: { width: 1280, height: 800 },
    });
    await languageContext.addInitScript(() => {
      localStorage.setItem('bankresaneh_lang', 'en');
      localStorage.removeItem('bankresaneh_token');
      localStorage.removeItem('server_url');
    });
    const languagePage = await languageContext.newPage();
    languagePage.setDefaultTimeout(20_000);
    languagePage.on('pageerror', error => diagnostics.pageErrors.push({
      viewport: 'saved-language', message: error.message, stack: error.stack,
    }));
    const languageResponse = await languagePage.goto(baseURL + '/', { waitUntil: 'domcontentloaded', timeout: 90_000 });
    assert.ok(languageResponse && languageResponse.ok(), 'Saved-language login navigation must return HTTP 2xx');
    await languagePage.locator('#login-username').waitFor({ state: 'visible', timeout: 30_000 });
    await languagePage.waitForFunction(() => document.documentElement.lang === 'en', { timeout: 10_000 });
    assert.equal(await languagePage.locator('#login-username').isVisible(), true, 'Login form must remain interactive with saved English preference');
    await languageContext.close();

    // Exercise the real authenticated archive path when preview credentials
    // are configured as repository secrets. Never guess or brute-force a login.
    const previewUsername = process.env.PREVIEW_ADMIN_USERNAME;
    const previewPassword = process.env.PREVIEW_ADMIN_PASSWORD;
    if (previewUsername && previewPassword) {
      const loginResponse = await fetch(baseURL + '/api/auth/login', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ username: previewUsername, password: previewPassword }),
      });
      const loginData = await loginResponse.json().catch(() => ({}));
      assert.equal(loginResponse.status, 200, 'Preview admin login must succeed before archive acceptance');
      assert.ok(loginData.token, 'Preview login must return a session token');
      const archiveHeaders = { authorization: 'Bearer ' + loginData.token };
      let totalShows = 0;
      let totalPages = 1;
      const loadedNumbers = new Set();
      for (let archivePage = 1; archivePage <= totalPages; archivePage += 1) {
        const response = await fetch(baseURL + '/api/shows?page=' + archivePage + '&limit=500', { headers: archiveHeaders });
        assert.equal(response.status, 200, 'Authenticated preview archive page ' + archivePage + ' must return HTTP 200');
        const payload = await response.json();
        assert.ok(Array.isArray(payload.shows), 'Archive page must contain a shows array');
        payload.shows.forEach(show => loadedNumbers.add(Number(show.num)));
        totalShows = Number(payload.pagination?.total);
        totalPages = Number(payload.pagination?.totalPages) || 1;
        assert.ok(archivePage <= 10, 'Archive pagination exceeded the safety limit');
      }
      assert.equal(loadedNumbers.size, totalShows, 'Archive pages must contain unique program records');
      assert.equal(totalShows, Number(process.env.PREVIEW_EXPECTED_SHOWS || 1302), 'Preview archive must contain the expected number of programs');
      await page.evaluate(token => localStorage.setItem('bankresaneh_token', token), loginData.token);
      const authenticatedResponses = [];
      page.on('response', response => {
        if (response.url().includes('/api/shows?page=')) authenticatedResponses.push(response.status());
      });
      await page.reload({ waitUntil: 'domcontentloaded' });
      await page.getByText('در حال بارگذاری...', { exact: true }).waitFor({ state: 'detached', timeout: 30_000 });
      await page.locator('#login-username').waitFor({ state: 'detached', timeout: 10_000 });
      await page.getByRole('alert').waitFor({ state: 'detached', timeout: 30_000 });
      assert.ok(authenticatedResponses.length >= totalPages, 'Authenticated UI must request every archive page');
      assert.deepEqual(authenticatedResponses.filter(status => status !== 200), [], 'Authenticated UI archive requests must all succeed');
      diagnostics.authenticatedArchive = { result: 'PASS', totalShows, totalPages, uniqueProgramNumbers: loadedNumbers.size, uiPageResponses: authenticatedResponses };
    } else {
      diagnostics.authenticatedArchive = { result: 'NOT_RUN', reason: 'Set PREVIEW_ADMIN_USERNAME and PREVIEW_ADMIN_PASSWORD GitHub Actions secrets to verify the authenticated archive in the live preview.' };
      console.warn('Authenticated archive acceptance NOT RUN: preview admin secrets are not configured.');
    }

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
