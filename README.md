# Expense Tracker

Production-ready Vite + React + TypeScript expense tracker with a local SQLite backend, real auth, and typed API contracts.

## Local Setup

1. Install dependencies:
   `npm install`
2. Create a local environment file from [.env.example](/Users/prafulreddy/Desktop/codex/EXPENSE_TRACKER/.env.example) and fill in the secrets.
3. Start the app:
   `npm run dev`

The dev script launches the frontend and backend together and applies pending SQL migrations automatically on startup.

If you want to inspect or apply migrations separately, you can still run:

- `npm run migrate`
- `npm run migrate:status`

## Environment Variables

`APP_URL`
Frontend origin used for redirects and links.

`HOST`
Backend host binding. Defaults to `127.0.0.1`.

`PORT`
Backend port used by the Express server.

`API_PREFIX`
Prefix for all API routes, usually `/api`.

`VITE_API_BASE_URL`
Client-facing API base path. Keep this relative in local development.

`SQLITE_PATH`
SQLite file path relative to the repo root.

`UPLOAD_DIR`
Directory used for uploaded receipt images. Uploaded files are stored by URL, not base64.

`PRIMARY_CURRENCY`
Currency used for summaries and normalized reporting.

`REPORT_HORIZON_DAYS`
How far recurring expenses should be projected into the future.

`JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`
Long random secrets used to sign auth tokens.

`SESSION_COOKIE_NAME`, `REFRESH_COOKIE_NAME`
Cookie names for auth session storage.

`AUTH_COOKIE_SECURE`, `COOKIE_SECURE`, `AUTH_COOKIE_PATH`, `AUTH_COOKIE_SAMESITE`, `AUTH_COOKIE_DOMAIN`, `AUTH_ISSUER`
Optional cookie/session overrides used by the auth layer.

## Migrations

SQL migrations live in [db/migrations](/Users/prafulreddy/Desktop/codex/EXPENSE_TRACKER/db/migrations).

Apply them with:

`npm run migrate`

The migration runner tracks applied files in the database itself, so it is safe to rerun.

## Production Notes

- Vite production builds ship with hashed asset names and sourcemaps disabled.
- The backend uses secure cookie-based JWT auth, SQLite persistence, and static receipt uploads under `UPLOAD_DIR`.
- Server logs should use structured JSON in production and readable console output in development.
- No secrets, API keys, or hardcoded user data are committed to the repo.

## Deployment

- Build the frontend with `npm run build`.
- Run the backend with the same environment variables used locally.
- Persist the SQLite database file and uploads directory on durable storage.
- Point your reverse proxy or platform router at the API and serve the `dist/` directory for the client.
