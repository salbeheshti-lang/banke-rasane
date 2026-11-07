// Concurrency test for the atomic translation rate limiter (P07).
// Mirrors src/app/api/translate/route.ts checkRateLimit EXACTLY
// (updateMany single-statement atomic approach) and uses the same
// connection tuning as src/lib/db.ts (connection_limit=1 for SQLite).
import { PrismaClient } from '@prisma/client';

const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const RATE_LIMIT_MAX = 10;

function tunedUrl() {
  const url = process.env.DATABASE_URL;
  if (!url || !url.startsWith('file:')) return url;
  if (url.includes('connection_limit=')) return url;
  return `${url}${url.includes('?') ? '&' : '?'}connection_limit=1`;
}

const db = new PrismaClient({
  datasources: { db: { url: tunedUrl() } },
});

async function checkRateLimit(userId) {
  const now = Date.now();
  const nowBig = BigInt(now);
  const windowReset = BigInt(now + RATE_LIMIT_WINDOW_MS);
  try {
    await db.translationRateBucket.upsert({
      where: { key: userId },
      create: { key: userId, count: 0, resetAt: windowReset },
      update: {},
    });
    const updated = await db.translationRateBucket.updateMany({
      where: {
        key: userId,
        count: { lt: RATE_LIMIT_MAX },
        resetAt: { gt: nowBig },
      },
      data: { count: { increment: 1 } },
    });
    if (updated.count === 1) return { ok: true };
    const bucket = await db.translationRateBucket.findUnique({ where: { key: userId } });
    if (!bucket) {
      await db.translationRateBucket.upsert({
        where: { key: userId },
        create: { key: userId, count: 1, resetAt: windowReset },
        update: { count: 1, resetAt: windowReset },
      });
      return { ok: true };
    }
    if (bucket.resetAt <= nowBig) {
      await db.translationRateBucket.update({
        where: { key: userId },
        data: { count: 1, resetAt: windowReset },
      });
      return { ok: true };
    }
    return { ok: false, retryAfter: Math.ceil((Number(bucket.resetAt) - now) / 1000) };
  } catch (e) {
    console.error('DB error (fail-open):', e.message || e);
    return { ok: true };
  }
}

async function main() {
  const user = 'test-concurrent-user';
  const user2 = 'test-second-user';
  await db.translationRateBucket.deleteMany({ where: { key: { in: [user, user2] } } });

  // TEST 1: 20 concurrent requests, same user
  const results = await Promise.all(Array.from({ length: 20 }, () => checkRateLimit(user)));
  const okCount = results.filter(r => r.ok).length;
  const rejected = results.filter(r => !r.ok);
  const finalBucket = await db.translationRateBucket.findUnique({ where: { key: user } });
  const finalCount = Number(finalBucket.count);
  console.log('=== TEST 1: 20 concurrent same-user requests ===');
  console.log(`allowed: ${okCount} (expect 10) | rejected: ${rejected.length} (expect 10) | stored count: ${finalCount} (expect 10)`);
  console.log(`sample retryAfter: ${rejected[0]?.retryAfter}s`);
  const t1 = okCount === 10 && rejected.length === 10 && finalCount === 10;
  console.log(`TEST 1 ${t1 ? 'PASS' : 'FAIL'}`);

  // TEST 2: persistence across restart (fresh client)
  const db2 = new PrismaClient({ datasources: { db: { url: tunedUrl() } } });
  const persisted = await db2.translationRateBucket.findUnique({ where: { key: user } });
  const t2 = persisted && Number(persisted.count) === 10;
  console.log(`=== TEST 2: persistence === count: ${Number(persisted?.count)} (expect 10) -> ${t2 ? 'PASS' : 'FAIL'}`);
  await db2.$disconnect();

  // TEST 3: per-user independence
  const r2 = await Promise.all(Array.from({ length: 12 }, () => checkRateLimit(user2)));
  const ok2 = r2.filter(r => r.ok).length;
  const t3 = ok2 === 10;
  console.log(`=== TEST 3: per-user independence === user2 allowed: ${ok2} (expect 10) -> ${t3 ? 'PASS' : 'FAIL'}`);

  // TEST 4: window reset
  await db.translationRateBucket.update({ where: { key: user }, data: { resetAt: BigInt(Date.now() - 1) } });
  const afterReset = await checkRateLimit(user);
  const t4 = afterReset.ok === true;
  console.log(`=== TEST 4: window reset === allowed: ${afterReset.ok} (expect true) -> ${t4 ? 'PASS' : 'FAIL'}`);

  // TEST 5: run TEST 1 three times for stability
  let stability = true;
  for (let i = 0; i < 3; i++) {
    await db.translationRateBucket.deleteMany({ where: { key: user } });
    const r = await Promise.all(Array.from({ length: 20 }, () => checkRateLimit(user)));
    const okc = r.filter(x => x.ok).length;
    if (okc !== 10) { stability = false; console.log(`  stability run ${i + 1}: allowed=${okc} (FAIL)`); }
  }
  console.log(`=== TEST 5: stability (3x reruns) === ${stability ? 'PASS' : 'FAIL'}`);

  await db.translationRateBucket.deleteMany({ where: { key: { in: [user, user2] } } });
  await db.$disconnect();

  const all = t1 && t2 && t3 && t4 && stability;
  console.log(all ? 'ALL TESTS PASS' : 'SOME TESTS FAILED');
  process.exit(all ? 0 : 1);
}

main().catch(e => { console.error(e); process.exit(1); });
