# Cloudflare deployment

The current Next.js application is built for Node.js standalone hosting and Electron by default. Cloudflare Workers uses a separate OpenNext build; the legacy `worker/` directory is not the current frontend or API.

## Local validation

```sh
bun install
bun run cloudflare:build
bun run cloudflare:preview
```

Deploy only after the local Worker preview and the Cloudflare CI build pass:

```sh
bun run cloudflare:deploy
```

## Required production configuration

The Worker hosts the Next.js frontend and route handlers. The data/auth service remains a separate Bun API deployment with persistent SQLite storage.

Set these Worker environment values:
- `BANKRESANEH_API_BASE`: HTTPS origin for the Bun API service.
- `BANKRESANEH_ALLOWED_API_ORIGINS`: comma-separated HTTPS origins allowed for per-user API-server switching.

Set secrets and provider credentials with Wrangler/Cloudflare secrets; do not commit them.

The following state is now stored by the selected Bun API backend, rather than the Next.js frontend filesystem:
- report title, subtitle, and organization defaults;
- report logo bytes and metadata;
- per-user persistent translation rate-limit buckets.

The API service must use a persistent writable disk/volume for its SQLite database and report assets. Configure HTTPS, a strict CORS allowlist, a changed initial admin password, and the API host allowlist before exposing it publicly.

## Deployment verification still required

- `cloudflare:build` and `cloudflare:preview` must pass against the actual app before deploying.
- A live Cloudflare account, Worker name/domain, secrets, and API hostname are not configured in this repository. CI never deploys or creates Cloudflare resources.
- Verify login, report settings/logo, translation throttling, social publishing, image import, and binary PDF generation against the deployed Worker plus the persistent Bun API. A successful adapter build alone is not proof of production readiness.

Cloudflare recommends vinext for new Next.js projects and documents OpenNext as the maintenance path for existing OpenNext applications. This repository keeps Next.js and uses the explicit OpenNext adapter to avoid an unrequested framework migration.
