# Mobile Deployment Notes

This app now runs as a local-first mobile workspace:

- Expenses, budgets, categories, receipts, and avatars are stored in app-local browser storage.
- Quick Add opens at `/quick-add`.
- A compact shortcut-friendly mode opens at `/watch-add`.
- The PWA manifest exposes both shortcuts so installed users can launch them directly.

## Store Submission Checklist

Before submitting to Google Play, make sure these items are true:

- The Android wrapper or TWA uses the final `applicationId` that matches the asset links file.
- `public/.well-known/assetlinks.json` contains the real package name and the release app-signing SHA-256 fingerprint.
- The asset links file is hosted over HTTPS at `/.well-known/assetlinks.json` on the final production domain and is publicly reachable without redirects that change the final URL.
- The Play Console listing is complete: app name, description, screenshots, icon, feature graphic, privacy policy URL, and Data Safety answers.
- The release build you test is the same signing setup you plan to publish. If Play App Signing is enabled, use the app signing certificate fingerprint from Play Console, not the upload key fingerprint.
- The PWA manifest icons, screenshots, shortcuts, and `start_url` all resolve from the production origin.
- Any native wrapper permissions or runtime features are documented separately from the PWA shortcuts.

## Android / Play Store

For Play Store delivery, package the built PWA as a Trusted Web Activity and publish the matching Digital Asset Links file:

- Trusted Web Activity quick start:
  [developer.android.com/develop/ui/views/layout/webapps/guide-trusted-web-activities-version2](https://developer.android.com/develop/ui/views/layout/webapps/guide-trusted-web-activities-version2)
- App-specific storage guidance:
  [developer.android.com/training/data-storage/app-specific](https://developer.android.com/training/data-storage/app-specific?hl=en)
- Android app shortcuts:
  [developer.android.com/guide/topics/ui/shortcuts](https://developer.android.com/guide/topics/ui/shortcuts)

Important: the Android wrapper must be configured with the same package name that appears in `public/.well-known/assetlinks.json`, and the fingerprint must be the certificate that signs the release artifact users install.

## Smart Watch / Wear OS

The `/watch-add` route gives you a tiny-screen quick entry surface, but a true smartwatch shortcut or tile still requires a native Wear OS companion:

- Wear OS tiles overview:
  [developer.android.com/design/ui/wear/guides/surfaces/tiles](https://developer.android.com/design/ui/wear/guides/surfaces/tiles)
- Wear OS tiles implementation:
  [developer.android.com/training/articles/wear-tiles](https://developer.android.com/training/articles/wear-tiles)

That means the phone app is shortcut-ready today, while an actual watch tile/action is the next native step if you want first-class Wear OS support.
