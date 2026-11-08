# BankResaneh security remediation — 2026-11-08

## Dependency audit

- Initial Bun audit on the locked dependency graph checked 1,052 packages and reported 62 high/critical advisories (5 critical, 57 high).
- The first compatible-range remediation updated 23 packages and fixed 95 reported vulnerability instances.
- Patched direct dependencies now include Next.js 16.4.1, NextAuth 4.24.15, Sharp 0.35.5, Prisma 6.19.2 and Zod 4.6.6.
- Scoped overrides pin the patched versions required by transitive dependencies: deepmerge-ts 8.0.2 and Effect 3.22.4 under @prisma/config; js-yaml 4.3.2 globally; minimatch 9.0.9 under @electron/universal. The @electron/asar branch retains minimatch 3.1.4 rather than forcing an incompatible major version.
- Final Bun audit gate: **no high or critical vulnerabilities found across 1,052 packages**. The report notes two items below the high-severity threshold; the full advisory report is emitted by the Quality workflow for review.
- The Quality workflow now reports all advisory severities and fails the build if any high/critical advisory returns.

## API and authentication

- Password storage uses scrypt; legacy SHA-256 hashes are upgraded after successful authentication.
- Five failed login attempts trigger a 15-minute lockout; a regression test verifies HTTP 429 on the sixth attempt and isolation between client IP buckets.
- Non-loopback/server bootstrap rejects the public admin/admin credential and requires BANKRESANEH_ADMIN_PASSWORD (at least 12 characters).
- API binds to 127.0.0.1 by default. Caddy explicitly overwrites X-Forwarded-For with the remote client address when proxying.
- Regression suite passed on the previous code revision: 85/85 fresh-database checks and 88/88 upgrade-database checks. These suites are being rerun against the final dependency lockfile.

## Electron packaging and runtime

- Next.js standalone output is copied once to resources/next-service-dist by the afterPack hook, avoiding the duplicate standalone payload.
- The Windows workflow verifies the packaged Next.js module and required runtime files, runs the actual NSIS installer in silent mode with a 10-minute timeout, then launches the installed BankResaneh.exe and checks Next.js, API, database seeding and authentication.
- The Prisma translation-rate-limit database is stored in the writable user-data directory.
- .env.example documents the loopback default and the strong bootstrap password required for non-loopback deployments.

## Release gate

This is not a release approval. Keep the security PR in draft until the latest dependency lockfile passes Quality, API security tests, Windows desktop build, NSIS install and installed-app smoke test. Preserve the current visual design; no visual redesign is part of this remediation.
