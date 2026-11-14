# API server switching

The client stores the selected API origin in `server_url`. Direct Bun API requests and authenticated Next.js route handlers now use the same selected origin.

## Frontend/Next.js host configuration

Set:
- `BANKRESANEH_API_BASE`: the default Bun API origin for users who have not selected a custom server.
- `BANKRESANEH_ALLOWED_API_ORIGINS`: comma-separated additional API origins that users may select.

Production custom origins must use HTTPS. Plain HTTP is accepted only for loopback addresses used by local/Electron deployments. An origin not in the allowlist is rejected before the Next.js host makes an outbound request; do not disable this validation.

Example:

```env
BANKRESANEH_API_BASE=https://api.example.com
BANKRESANEH_ALLOWED_API_ORIGINS=https://api.example.com,https://api-backup.example.com
```

## Bun API host configuration

- Configure the API's CORS allowlist to include the frontend origins that call it.
- Use a persistent writable data directory and database volume.
- The API stores report defaults, report logo bytes, and translation rate-limit buckets in its data directory/database. Electron sets `BANKRESANEH_DATA_DIR` to its user-data directory automatically.
- Keep HTTPS enabled and do not expose the internal readiness endpoint without its startup token.

## What follows the selected API

- Authentication and permission checks for Next.js routes.
- Report defaults and logo storage.
- Persistent translation rate limiting.
- Direct show, user, genre, image, and attachment API operations.

Next.js-only integrations such as external image lookup, social publishing, and PDF rendering execute on the frontend host, but authorize the session against the selected API. Keep those provider credentials on the frontend host; do not send them to the browser.
