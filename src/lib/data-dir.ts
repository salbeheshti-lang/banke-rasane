// Resolves the writable data directory for the BankResaneh app.
//
// Priority:
//   1. BANKRESANEH_DATA_DIR env var — set by the Electron launcher to
//      app.getPath('userData'). In production (Windows install), this is
//      %APPDATA%\banke-rasane (writable by the current user).
//   2. process.cwd()/data — fallback for dev mode (project root).
//
// IMPORTANT: never write to process.cwd()/data in production — on Windows
// the app may be installed under Program Files where the user has no
// write permission, causing silent failures (the previous translate
// endpoint's rate-limit file had this bug).

import fs from 'fs';
import path from 'path';
import os from 'os';

let resolvedDataDir: string | null = null;

export function getDataDir(): string {
  if (resolvedDataDir) return resolvedDataDir;

  // 1. Environment override (set by Electron launcher)
  const envDir = process.env.BANKRESANEH_DATA_DIR;
  if (envDir && envDir.trim()) {
    resolvedDataDir = path.resolve(envDir.trim());
  } else {
    // 2. Fallback: project root /data (dev mode)
    resolvedDataDir = path.join(process.cwd(), 'data');
  }

  // Ensure the directory exists. If it can't be created (e.g. read-only
  // install dir without the env override), fall back to the OS temp dir
  // as a last resort so the app doesn't crash — just logs a warning.
  try {
    if (!fs.existsSync(resolvedDataDir)) {
      fs.mkdirSync(resolvedDataDir, { recursive: true });
    }
    // Test write permission
    const testFile = path.join(resolvedDataDir, '.write-test');
    fs.writeFileSync(testFile, 'ok', 'utf-8');
    fs.unlinkSync(testFile);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(`[data-dir] cannot write to ${resolvedDataDir} (${msg}); falling back to OS temp dir`);
    resolvedDataDir = path.join(os.tmpdir(), 'bankresaneh-data');
    try {
      if (!fs.existsSync(resolvedDataDir)) {
        fs.mkdirSync(resolvedDataDir, { recursive: true });
      }
    } catch {
      // If even the temp dir fails, give up and return the original path
      // — the caller will handle the write error itself.
    }
  }

  return resolvedDataDir;
}

/**
 * Resolve a file path inside the writable data directory.
 * Usage: getDataFile('translate-rate-limit.json')
 */
export function getDataFile(filename: string): string {
  return path.join(getDataDir(), filename);
}
