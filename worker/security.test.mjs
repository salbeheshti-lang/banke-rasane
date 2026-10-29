import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { test } from 'node:test';
import worker from './index.js';

function makeEnv(allowedOrigins = '') {
  const sqlite = new DatabaseSync(':memory:');
  sqlite.exec(`
    CREATE TABLE users (
      id INTEGER PRIMARY KEY,
      username TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL DEFAULT '',
      salt TEXT NOT NULL DEFAULT '',
      role TEXT NOT NULL DEFAULT 'viewer',
      name TEXT NOT NULL DEFAULT ''
    );
    CREATE TABLE sessions (
      token TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL,
      expires_at TEXT NOT NULL
    );
    CREATE TABLE shows (
      num INTEGER PRIMARY KEY,
      name TEXT NOT NULL DEFAULT '',
      category TEXT NOT NULL DEFAULT '',
      source TEXT NOT NULL DEFAULT '',
      size TEXT NOT NULL DEFAULT '',
      viewers TEXT NOT NULL DEFAULT '',
      style TEXT NOT NULL DEFAULT '',
      effects TEXT NOT NULL DEFAULT '',
      layout TEXT NOT NULL DEFAULT '',
      elements TEXT NOT NULL DEFAULT '',
      materials TEXT NOT NULL DEFAULT '',
      colors TEXT NOT NULL DEFAULT '',
      lighting TEXT NOT NULL DEFAULT '',
      summary TEXT NOT NULL DEFAULT '',
      descriptionFa TEXT NOT NULL DEFAULT '',
      youtube TEXT NOT NULL DEFAULT '',
      imdb TEXT NOT NULL DEFAULT '',
      wikipedia TEXT NOT NULL DEFAULT '',
      socialPost TEXT NOT NULL DEFAULT '',
      images TEXT NOT NULL DEFAULT '[]',
      videos TEXT NOT NULL DEFAULT '[]',
      updated_at TEXT
    );
  `);
  sqlite.exec(readFileSync(new URL('./migrations/0001_auth_login_attempts.sql', import.meta.url), 'utf8'));

  const DB = {
    prepare(sql) {
      const statement = sqlite.prepare(sql);
      let values = [];
      const bound = {
        bind(...args) {
          values = args;
          return bound;
        },
        async first() {
          return statement.get(...values) ?? null;
        },
        async all() {
          return { results: statement.all(...values) };
        },
        async run() {
          return statement.run(...values);
        },
      };
      return bound;
    },
  };

  return { env: { DB, ALLOWED_ORIGINS: allowedOrigins }, sqlite };
}

async function call(path, { method = 'GET', headers = {}, body } = {}, env) {
  const request = new Request(`https://api.example.test${path}`, {
    method,
    headers: new Headers(headers),
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return worker.fetch(request, env, {});
}

test('accepts a valid, unexpired session', async () => {
  const { env, sqlite } = makeEnv();
  sqlite.prepare('INSERT INTO users (id, username, role, name) VALUES (?, ?, ?, ?)').run(1, 'viewer1', 'viewer', 'Viewer');
  sqlite.prepare('INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)').run(
    'active-token',
    1,
    new Date(Date.now() + 60_000).toISOString(),
  );

  const response = await call('/api/auth/me', {
    headers: { Authorization: 'Bearer active-token' },
  }, env);

  assert.equal(response.status, 200);
  assert.equal((await response.json()).username, 'viewer1');
  sqlite.close();
});

test('rejects an expired session, including one expired earlier today', async () => {
  const { env, sqlite } = makeEnv();
  sqlite.prepare('INSERT INTO users (id, username, role, name) VALUES (?, ?, ?, ?)').run(1, 'viewer1', 'viewer', 'Viewer');
  sqlite.prepare('INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)').run(
    'expired-token',
    1,
    new Date(Date.now() - 60_000).toISOString(),
  );

  const response = await call('/api/auth/me', {
    headers: { Authorization: 'Bearer expired-token' },
  }, env);

  assert.equal(response.status, 401);
  sqlite.close();
});

test('requires authentication for protected routes and disables caching', async () => {
  const { env, sqlite } = makeEnv();
  const response = await call('/api/users', {}, env);

  assert.equal(response.status, 401);
  assert.equal(response.headers.get('Cache-Control'), 'no-store');
  sqlite.close();
});

test('CORS allowlist does not reflect an unapproved origin', async () => {
  const { env, sqlite } = makeEnv('https://bank.example');
  const response = await call('/api/users', {
    method: 'OPTIONS',
    headers: {
      Origin: 'https://evil.example',
      'Access-Control-Request-Method': 'GET',
    },
  }, env);

  assert.equal(response.status, 204);
  assert.equal(response.headers.get('Access-Control-Allow-Origin'), null);
  sqlite.close();
});

test('CORS allowlist reflects the exact approved origin only', async () => {
  const { env, sqlite } = makeEnv('https://bank.example,https://admin.bank.example');
  const response = await call('/api/users', {
    method: 'OPTIONS',
    headers: {
      Origin: 'https://admin.bank.example',
      'Access-Control-Request-Method': 'GET',
    },
  }, env);

  assert.equal(response.status, 204);
  assert.equal(response.headers.get('Access-Control-Allow-Origin'), 'https://admin.bank.example');
  sqlite.close();
});

test('login throttling returns 429 after eight failed attempts from the same client and username', async () => {
  const { env, sqlite } = makeEnv();
  const headers = {
    'Content-Type': 'application/json',
    'CF-Connecting-IP': '203.0.113.10',
  };

  for (let i = 0; i < 8; i += 1) {
    const response = await call('/api/auth/login', {
      method: 'POST',
      headers,
      body: { username: 'missing-user', password: 'wrong-password' },
    }, env);
    assert.equal(response.status, 401);
  }

  const limited = await call('/api/auth/login', {
    method: 'POST',
    headers,
    body: { username: 'missing-user', password: 'wrong-password' },
  }, env);

  assert.equal(limited.status, 429);
  sqlite.close();
});

test('login rejects malformed JSON with 400 rather than an internal server error', async () => {
  const { env, sqlite } = makeEnv();
  const response = await worker.fetch(new Request('https://api.example.test/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{not-json',
  }), env, {});

  assert.equal(response.status, 400);
  sqlite.close();
});

test('login-attempt migration creates the table and index in SQLite', () => {
  const { sqlite } = makeEnv();
  const migration = readFileSync(new URL('./migrations/0001_auth_login_attempts.sql', import.meta.url), 'utf8');
  sqlite.exec(migration);

  const columns = sqlite.prepare('PRAGMA table_info(auth_login_attempts)').all().map(row => row.name);
  const indexes = sqlite.prepare('PRAGMA index_list(auth_login_attempts)').all().map(row => row.name);

  assert.deepEqual(columns, ['attempt_key', 'window_start', 'attempt_count']);
  assert.ok(indexes.includes('idx_auth_login_attempts_window'));
  sqlite.close();
});
