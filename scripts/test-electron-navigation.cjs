'use strict';

const assert = require('node:assert/strict');
const { classifyNavigation } = require('../electron/navigation-policy.cjs');

const port = 3000;

for (const url of [
  'http://127.0.0.1:3000/',
  'http://localhost:3000/programs',
]) {
  assert.deepEqual(classifyNavigation(url, port), { action: 'allow' });
}

for (const url of [
  'https://example.com/',
  'http://example.com/',
]) {
  const result = classifyNavigation(url, port);
  assert.equal(result.action, 'external');
  assert.equal(result.url, url);
}

for (const url of [
  'http://127.0.0.1.evil.example:3000/',
  'http://127.0.0.1:3001/',
  'file:///etc/passwd',
  'javascript:alert(1)',
  'data:text/html,hello',
  'not a url',
]) {
  assert.equal(classifyNavigation(url, port).action, 'block', url);
}

console.log('PASS Electron main-frame navigation policy.');
