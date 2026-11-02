/* eslint @typescript-eslint/no-require-imports: off */
// Exercises the browser API-base selector without changing the real user's browser storage.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const ts = require('typescript');

const source = fs.readFileSync(path.resolve(__dirname, '..', 'src', 'lib', 'api.ts'), 'utf8');
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText;

const values = new Map();
const localStorage = {
  getItem(key) { return values.has(key) ? values.get(key) : null; },
  setItem(key, value) { values.set(key, String(value)); },
  removeItem(key) { values.delete(key); },
};
const moduleObject = { exports: {} };
const windowObject = {
  location: { port: '3000', hostname: 'localhost', origin: 'http://localhost:3000' },
};
vm.runInNewContext(compiled, {
  module: moduleObject,
  exports: moduleObject.exports,
  localStorage,
  window: windowObject,
  URLSearchParams,
  fetch: globalThis.fetch,
  console,
});

const client = moduleObject.exports;
assert.equal(client.getApiBase(), 'http://127.0.0.1:3002', 'desktop default API address');
values.set('bankresaneh_token', 'old-session-token');
client.setApiBase('https://api.example.test:3443/');
assert.equal(client.getApiBase(), 'https://api.example.test:3443', 'custom API address is persisted');
assert.equal(client.getApiUrl('/api/health'), 'https://api.example.test:3443/api/health', 'custom API URL is used');
assert.equal(localStorage.getItem('bankresaneh_token'), null, 'changing servers clears the old server session');
assert.equal(client.getApiUrl('api/profile', 'https://override.example.test'), 'https://override.example.test/api/profile',
  'connection test can probe a not-yet-saved server');
client.setApiBase('');
assert.equal(client.getApiBase(), 'http://127.0.0.1:3002', 'clearing custom URL restores desktop default');

windowObject.location = { port: '', hostname: 'preview.space-z.ai', origin: 'https://preview.space-z.ai' };
assert.equal(client.getApiUrl('api/health'), 'https://preview.space-z.ai/api/health?XTransformPort=3002',
  'preview gateway routes the API to port 3002');

console.log('Client API-base smoke passed: default, persistence, override, token reset, reset-to-default, and preview gateway.');
