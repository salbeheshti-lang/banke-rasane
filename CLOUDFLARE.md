# Cloudflare deployment

The current Next.js application is deployed as a Node.js standalone server for Electron and conventional web hosting. Cloudflare support is an explicit, separate OpenNext build; the legacy `worker/` directory is not the production frontend or API for this application.

## Local validation

```sh
bun install
bun run cloudflare:build
bun run cloudflare:preview
```

Deploy only after the Cloudflare preview passes and the required secrets/bindings have been configured:

```sh
bun run cloudflare:deploy
```

Required environment configuration:
- `BANKRESANEH_API_BASE`: HTTPS origin for the current Bun-compatible API service.
- `BANKRESANEH_ALLOWED_API_ORIGINS`: comma-separated HTTPS origins permitted as per-user API backends.
- `OMDB_API_KEY` and any translation-provider credentials used by the deployment.

## Production blockers that must be resolved before enabling public deployment

The current application still has Node-specific persistence and runtime dependencies:
- Prisma uses SQLite for translation rate limits and local application data. A Cloudflare Worker cannot mount the desktop SQLite file; this must be moved to D1 or a separately hosted API.
- Report settings and custom logo currently use filesystem persistence. They need durable R2/KV storage (or the selected API backend) before deploying multiple Worker instances.
- The logo route currently uses native `sharp`; image normalization must be moved to a Workers-compatible implementation or performed before upload.
- The OpenNext build must pass against the actual application. Adding an adapter/config is not equivalent to a verified production deployment.

No Cloudflare account resources are created or deployed by CI. The legacy D1 worker under `worker/` remains isolated and must not be pointed at production traffic.
