import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const dataDir = mkdtempSync(path.join(tmpdir(), 'bankresaneh-prisma-runtime-'));
const databasePath = path.join(dataDir, 'db', 'translation-rate-limit.sqlite');
process.env.DATABASE_URL = pathToFileURL(databasePath).href;

const { db } = await import('../src/lib/db.ts');

try {
  await db.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS "TranslationRateBucket" (
    "key" TEXT NOT NULL PRIMARY KEY,
    "count" INTEGER NOT NULL DEFAULT 0,
    "resetAt" BIGINT NOT NULL
  )`);

  const resetAt = BigInt(Date.now() + 60_000);
  await db.translationRateBucket.upsert({
    where: { key: 'runtime-smoke-user' },
    create: { key: 'runtime-smoke-user', count: 1, resetAt },
    update: { count: 1, resetAt },
  });

  const row = await db.translationRateBucket.findUnique({
    where: { key: 'runtime-smoke-user' },
  });
  if (!row || row.count !== 1 || row.resetAt !== resetAt) {
    throw new Error('Prisma SQLite runtime round-trip returned unexpected data');
  }
  console.log('Prisma SQLite runtime smoke test passed:', databasePath);
} finally {
  await db.$disconnect();
  rmSync(dataDir, { recursive: true, force: true });
}
