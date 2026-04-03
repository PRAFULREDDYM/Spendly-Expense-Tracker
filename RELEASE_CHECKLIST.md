# Play Store Release Checklist

Use this when you package the PWA as a Trusted Web Activity or Android wrapper.

## Fixed identifiers

- Android package ID: `com.prafulreddy.expensetracker`
- Asset links URL: `https://YOUR_DOMAIN/.well-known/assetlinks.json`
- Public privacy page: `https://YOUR_DOMAIN/privacy.html`

## 1. Prepare a release keystore

Generate a local keystore once and keep it outside source control:

```bash
keytool -genkeypair -v \
  -keystore release-key.jks \
  -alias expense-tracker \
  -keyalg RSA \
  -keysize 2048 \
  -validity 10000
```

Keep these values consistent across builds:

- Keystore file: `release-key.jks`
- Alias: `expense-tracker`
- Store password: your secret
- Key password: your secret

## 2. Get the SHA-256 fingerprint

For a locally signed release keystore:

```bash
keytool -list -v \
  -keystore release-key.jks \
  -alias expense-tracker
```

For Google Play submissions with Play App Signing, use:

- Play Console -> `Release` -> `Setup` -> `App integrity`
- Copy the `App signing certificate` SHA-256 fingerprint
- Do not use the upload key fingerprint in `assetlinks.json`

The only manual value left in `public/.well-known/assetlinks.json` should be that real Play app-signing SHA-256 fingerprint.

## 3. Verify Vercel hosting

In Vercel, set the project to deploy the repo root with:

- Build command: `npm run build`
- Output directory: `dist`
- Framework preset: `Other`

After deploy, confirm these URLs return `200` over HTTPS:

- `/manifest.webmanifest`
- `/privacy.html`
- `/.well-known/assetlinks.json`
- `/screenshots/mobile-dashboard.png`
- `/screenshots/mobile-history.png`

Make sure `/.well-known/assetlinks.json` is served without auth and without a redirect chain.

## 4. Create or update the Bubblewrap project

Use Bubblewrap to create the Android wrapper for the deployed manifest.

```bash
npx @bubblewrap/cli init
```

When prompted, use:

- Manifest URL: `https://YOUR_DOMAIN/manifest.webmanifest`
- Application ID: `com.prafulreddy.expensetracker`
- Launch URL / start URL: `https://YOUR_DOMAIN/?utm_source=pwa`
- App name: `Expense Tracker`

If your Bubblewrap version uses a different prompt order, keep the same values above.

## 5. Build APK and AAB artifacts

After Bubblewrap generates the Android project:

```bash
cd twa
./gradlew assembleRelease
./gradlew bundleRelease
```

Expected outputs:

- APK: `app/build/outputs/apk/release/app-release.apk`
- AAB: `app/build/outputs/bundle/release/app-release.aab`

Use the APK for side-loading and internal testing.
Use the AAB for Google Play submission.

## 6. Play Console submission

In Play Console:

1. Create the app with package ID `com.prafulreddy.expensetracker`.
2. Enable Play App Signing.
3. Upload the AAB from the Bubblewrap build.
4. Paste the app-signing SHA-256 fingerprint into `public/.well-known/assetlinks.json` before publishing.
5. Complete the store listing:
   - App name
   - Short and full descriptions
   - App icon
   - Feature graphic
   - Phone and tablet screenshots
   - Privacy policy URL
   - Data Safety form
6. Roll out to internal testing first.
7. Verify the TWA opens the deployed site, then promote to production.

## 7. Final checks

- `public/.well-known/assetlinks.json` uses `com.prafulreddy.expensetracker`.
- The SHA-256 fingerprint is the real Play app-signing fingerprint.
- The manifest `shortcuts` still point to `/quick-add` and `/watch-add`.
- The site serves HTTPS with no auth wall.
- The privacy page is live and linked from the store listing.

## Known blocker

The only value that still must come from your Play Console or signing certificate is the real SHA-256 fingerprint.
