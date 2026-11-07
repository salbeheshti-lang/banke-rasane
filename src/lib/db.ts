import { PrismaClient } from '@prisma/client'
import { mkdirSync } from 'node:fs'
import path from 'node:path'

const defaultDbPath = path.join(
  process.env.BANKRESANEH_DATA_DIR || process.cwd(),
  'db',
  'translation-rate-limit.sqlite',
)
if (!process.env.DATABASE_URL) {
  mkdirSync(path.dirname(defaultDbPath), { recursive: true })
}
const databaseUrl = process.env.DATABASE_URL || `file:${path.resolve(defaultDbPath).replace(/\\\\/g, '/')}`

// SQLite connection tuning:
//   connection_limit=1 — SQLite allows only ONE writer at a time; a pool of
//   parallel connections causes "database is locked" contention and
//   interactive-transaction socket timeouts (P1008) under concurrent load.
//   Serializing all queries through a single connection removes the file-lock
//   contention entirely. Correct for a desktop app whose own process is the
//   only writer.
function sqliteUrlWithTuning(url: string | undefined): string | undefined {
  if (!url) return url
  if (!url.startsWith('file:')) return url
  const joiner = url.includes('?') ? '&' : '?'
  if (url.includes('connection_limit=')) return url
  return `${url}${joiner}connection_limit=1`
}

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: ['query'],
    datasources: {
      db: { url: sqliteUrlWithTuning(databaseUrl) },
    },
  })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db