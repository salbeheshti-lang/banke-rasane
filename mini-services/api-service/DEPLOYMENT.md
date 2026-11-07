# API deployment and first-run security

## Desktop installation

The Electron desktop app starts the API on `127.0.0.1`. On a fresh local database, the initial account remains `admin / admin` and is required to change its password on first login. The API stores new passwords using PBKDF2-HMAC-SHA256.

## Remote server deployment

The API now binds to loopback by default. A server deployment must explicitly set:

- `BANKRESANEH_HOST=0.0.0.0` (or the intended interface)
- `BANKRESANEH_ADMIN_PASSWORD` to a strong value of at least 12 characters for first-time bootstrap when the database is empty or the account still has the public `admin / admin` credential.
- `CORS_ORIGINS` to a comma-separated list of the exact web-app origins that should call this API.
- `DB_PATH` to a persistent writable database path.

If a non-loopback deployment is about to create the default admin or detects that the admin account still uses the public default password, startup is refused unless `BANKRESANEH_ADMIN_PASSWORD` is configured. The configured password is hashed before it is stored, and the account is still required to change it on first login.

After the admin password has been changed, the bootstrap secret can be removed from the hosting environment. Do not commit the secret or place it in a client-side environment variable.

## Operational requirements

- Put the web app and API behind HTTPS in production.
- Persist `DB_PATH` and back it up before upgrades.
- Keep the API bound to loopback when it is only used by the Electron desktop app.
- Set explicit CORS origins for the deployed web app; do not rely on broad development origins.
- Never expose the SQLite database file or its WAL/SHM files through a static web server.
