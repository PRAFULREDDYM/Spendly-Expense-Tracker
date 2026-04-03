# Supabase Setup

This app now uses Supabase as the source of truth and keeps Dexie/IndexedDB as the offline cache on each device.

## 1. Create the Supabase project

1. Create a new project in Supabase.
2. In `Authentication -> Providers`, enable Email auth.
3. If you want `Continue with Google`, also enable the Google provider in Supabase Auth and paste your Google OAuth client ID and client secret there in the Supabase dashboard.
4. Add these redirect URLs in Supabase Auth:
   - `http://localhost:3000/dashboard`
   - your production URL + `/dashboard`
5. In `SQL Editor`, run [`supabase/schema.sql`](/Users/prafulreddy/Desktop/codex/EXPENSE_TRACKER/supabase/schema.sql).

## 2. Add environment variables

Update `.env`:

```bash
VITE_SUPABASE_URL="https://YOUR_PROJECT.supabase.co"
VITE_SUPABASE_ANON_KEY="YOUR_PUBLIC_ANON_KEY"
```

Only the `VITE_` variables are required by the current frontend build.
Google OAuth credentials are configured in the Supabase dashboard, not in this frontend `.env`.

## 3. Storage buckets

The schema creates two public buckets:

- `receipts`
- `avatars`

Each object is stored under a user folder:

- `receipts/<user-id>/<file>`
- `avatars/<user-id>/<file>`

## 4. Run locally

```bash
npm install
npm run dev
```

## 5. How sync works

- Supabase is the source of truth
- Dexie stores the latest synced workspace locally for offline reads
- When the app comes back online, the latest cloud state is fetched again

## Current limitation

This migration keeps offline cached reads. New writes still expect connectivity to sync immediately to Supabase.

## Release prep note

If you bundle this web app as a TWA for Play Store release, use the Android package ID `com.prafulreddy.expensetracker` and follow [`RELEASE_CHECKLIST.md`](/Users/prafulreddy/Desktop/codex/EXPENSE_TRACKER/RELEASE_CHECKLIST.md) for the asset links and signing steps.
