import { defineConfig, devices } from '@playwright/test';

const isCI = Boolean(process.env.CI);

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  forbidOnly: isCI,
  retries: isCI ? 1 : 0,
  workers: 1,
  reporter: isCI ? 'line' : 'list',
  use: {
    baseURL: 'http://127.0.0.1:3000',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    ...devices['Desktop Chrome'],
  },
  webServer: [
    {
      command: 'bun mini-services/api-service/index.js',
      url: 'http://127.0.0.1:3002/api/health',
      reuseExistingServer: !isCI,
      timeout: 60_000,
      env: {
        ...process.env,
        NODE_ENV: 'test',
        PORT: '3002',
        BANKRESANEH_HOST: '127.0.0.1',
        BANKRESANEH_SEED_PATH: process.env.BANKRESANEH_SEED_PATH || '.e2e/seed.json',
        BANKRESANEH_DATA_DIR: process.env.BANKRESANEH_DATA_DIR || '.e2e/data',
        DB_PATH: process.env.DB_PATH || '.e2e/api.sqlite',
      },
    },
    {
      command: 'bunx next dev --hostname 127.0.0.1 --port 3000',
      url: 'http://127.0.0.1:3000',
      reuseExistingServer: !isCI,
      timeout: 120_000,
      env: {
        ...process.env,
        DATABASE_URL: process.env.DATABASE_URL || 'file:./.e2e/translation.sqlite',
        BANKRESANEH_API_BASE: process.env.BANKRESANEH_API_BASE || 'http://127.0.0.1:3002',
      },
    },
  ],
});
