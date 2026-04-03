# Setting up watch shortcuts

## Read this first

This repository ships PWA shortcuts and a compact `/watch-add` route, but that is not the same thing as a native watch app.

- The watch guidance below is for shortcut-style entry flows.
- Android Play Store submission still requires a real Android wrapper or TWA build with the correct application ID and signing certificate.
- The concrete Android package ID for this repo is `com.prafulreddy.expensetracker`.
- Do not publish until `public/.well-known/assetlinks.json` matches that package ID and the release SHA-256 fingerprint from the signing certificate you will actually ship.
- Follow [`RELEASE_CHECKLIST.md`](/Users/prafulreddy/Desktop/codex/EXPENSE_TRACKER/RELEASE_CHECKLIST.md) for the signing and submission flow.

## Apple Watch via Siri

1. On iPhone, open the Shortcuts app.
2. Tap `+`, then add an `Open URL` action.
3. Enter your deployed app URL with `/quick-add`, for example `https://YOUR_APP_URL/quick-add`.
4. Rename the shortcut to `Log expense`.
5. Tap `Share`, then choose `Add to Home Screen` or expose it to Apple Watch if available in your setup.
6. Say `Hey Siri, log expense` to launch Quick Add on the phone.

## Android Watch via Wear OS quick tiles

1. Install the app on your phone from Play Store after packaging the PWA/TWA.
2. On the watch, swipe down to Quick Settings.
3. Tap `Edit` and find `Expense Tracker`.
4. Drag it into the active quick tiles area.
5. Tapping the tile opens the phone shortcut flow and lands on Quick Add.

## Deployment notes

- `/quick-add` is the main shortcut target for fast expense logging.
- `/watch-add` stays available for extra-compact small-screen layouts.
- `public/.well-known/assetlinks.json` must match `com.prafulreddy.expensetracker` exactly and must use the release app-signing SHA-256 fingerprint, not a placeholder or upload-key fingerprint.
- The asset links file must be served from `https://YOUR_DOMAIN/.well-known/assetlinks.json` with no auth wall and no redirect chain that changes the final URL.
- The Play Store checklist also needs the store listing assets, privacy policy URL, and Data Safety answers before review can pass.
- `public/add-to-siri.json` is a helper scaffold for sharing the Siri setup details with testers.
