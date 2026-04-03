# COMPLETE STEPS

This guide explains what to do from this codebase to a live mobile release on Google Play Store and Apple App Store.

## 1. Prerequisites on your Mac

1. Install Node.js 20 or newer.
   Why: this project uses Vite, React, Capacitor, and native asset tooling through Node.

2. Install Java JDK 17 or newer.
   Why: Android Studio and Gradle need Java to build Android apps.

```bash
java -version
```

3. If Java is missing, install a JDK from [https://adoptium.net](https://adoptium.net).

4. Install Android Studio from [https://developer.android.com/studio](https://developer.android.com/studio).
   During setup, install:
   - Android SDK
   - Android SDK Platform
   - Android SDK Build-Tools
   - Android Virtual Device support

5. Install Xcode from the Mac App Store.
   Why: iOS builds, signing, and App Store submission all go through Xcode.

6. Open Xcode once and install any required components.

7. Install CocoaPods if your Mac does not already have it.
   Capacitor iOS projects often need it in native workflows.

```bash
sudo gem install cocoapods
```

8. Create or confirm these developer accounts:
   - Google Play Console account
   - Apple Developer account

9. Keep these things safe before release:
   - Android keystore file
   - Android keystore password
   - Apple signing certificates and provisioning access
   - Supabase project URL and anon key

## 2. Daily project commands

1. Install project dependencies.

```bash
npm install
```

2. Run the app in the browser during development.

```bash
npm run dev
```

3. Before opening the native projects, always rebuild and sync Capacitor.

```bash
npm run cap:sync
```

Why: Capacitor native apps do not read your source files directly. They use the built web app inside `dist/`, which then gets copied into the Android and iOS projects.

## 3. How to open the Android project

1. Build and sync the latest code.

```bash
npm run build:android
```

2. If you only want to sync without opening Android Studio:

```bash
npx cap sync android
```

3. Open Android Studio if it does not open automatically.

4. Choose `Open` and select:

```text
android/
```

5. Wait for Gradle sync to finish.

6. To test on a device:
   - enable Developer Options on your Android phone
   - enable USB debugging
   - connect the phone
   - choose the device in Android Studio
   - click Run

## 4. Generate the Android signing keystore

1. Generate a release keystore once.

```bash
keytool -genkey -v -keystore expense-tracker-release.keystore -alias expensetracker -keyalg RSA -keysize 2048 -validity 25000 -dname "CN=Praful Reddy, OU=Mobile, O=ExpenseTracker, L=YourCity, ST=YourState, C=IN"
```

2. Use a strong password.

3. Back up the `.keystore` file immediately to a secure location.
   Why: if you lose it, updating the Android app later becomes very difficult.

4. Save the password in your password manager immediately.

5. Get the SHA-256 fingerprint from the keystore.

```bash
keytool -list -v -keystore expense-tracker-release.keystore -alias expensetracker | grep "SHA256"
```

6. Use that SHA-256 in your production asset links flow when you finalize Android app linking.

## 5. Generate a signed Android AAB in Android Studio

1. Open the Android project in Android Studio.

2. In the top menu, choose:
   `Build -> Generate Signed Bundle / APK`

3. Choose:
   `Android App Bundle`

4. Select your keystore file:

```text
expense-tracker-release.keystore
```

5. Enter:
   - keystore password
   - key alias: `expensetracker`
   - key password

6. Choose the `release` build variant.

7. Finish the wizard.

8. Android Studio will generate an `.aab` file.
   This is the format Google Play prefers for submission.

9. Typical output location:

```text
android/app/release/
```

or

```text
android/app/build/outputs/bundle/release/
```

10. Keep the generated file for Play Console upload.

## 6. Submit to Google Play Store

1. Open [https://play.google.com/console](https://play.google.com/console).

2. Create a new app.

3. Fill in:
   - App name: `Expense Tracker`
   - Default language: `English (United States)`
   - App type: `App`
   - Paid or free: `Free`

4. Complete the store listing:
   - short description
   - full description
   - screenshots
   - feature graphic
   - app icon
   - category: Finance

5. Use this short description:

```text
Track expenses and income. Works offline. Syncs across all your devices.
```

6. Use your app privacy policy URL from production.

7. Go to:
   `Testing -> Internal testing`

8. Create a release and upload the signed `.aab`.

9. Save and roll out to internal testing first.

10. Install it on your own Android phone through the Play testing track and verify:
   - login works
   - sync works
   - offline writes replay when online returns
   - quick add works
   - receipt upload works
   - haptics work on native taps

11. After internal testing is stable, promote the build to production.

## 7. How to open the iOS project

1. Build and sync the latest code.

```bash
npm run build:ios
```

2. If you only want to sync without opening Xcode:

```bash
npx cap sync ios
```

3. Open the iOS workspace in Xcode:

```text
ios/App/App.xcworkspace
```

4. In Xcode, select the `App` target.

5. In `Signing & Capabilities`, choose your Apple Developer Team.

6. Confirm the bundle identifier is:

```text
com.prafulreddy.expensetracker
```

7. Connect an iPhone if you want to test directly on a device, then choose it from the device selector and click Run.

## 8. Archive and upload to App Store Connect

1. In Xcode, set the target device to:
   `Any iOS Device (arm64)`

2. In the top menu, choose:
   `Product -> Archive`

3. Wait for the archive to finish.

4. The Organizer window will open.

5. Select the archive and choose:
   `Distribute App`

6. Choose:
   `App Store Connect`

7. Follow the signing and validation steps.

8. Upload the build.

9. Wait for the build to appear in App Store Connect.

## 9. Submit to Apple App Store

1. Open [https://appstoreconnect.apple.com](https://appstoreconnect.apple.com).

2. Create a new app.

3. Fill in:
   - Platform: iOS
   - Name: `Expense Tracker`
   - Primary language: English
   - Bundle ID: `com.prafulreddy.expensetracker`
   - SKU: any internal identifier you want, for example `expense-tracker-ios-1`

4. After the uploaded build is processed, attach it to the app version.

5. Complete App Store listing items:
   - subtitle
   - description
   - keywords
   - screenshots
   - app icon
   - support URL
   - privacy policy URL

6. In App Privacy, answer the privacy questions honestly based on the app’s real behavior.

7. In Review Information, add any notes needed for the reviewer.

8. Submit the app for review.

## 10. How to update the app after going live

1. Make your code changes in this repo.

2. Rebuild and sync the native wrappers.

```bash
npm run cap:sync
```

3. Open Android Studio or Xcode again.

4. Rebuild the Android release bundle or archive the iOS app again.

5. Upload the new Android AAB to Play Console.

6. Upload the new iOS archive to App Store Connect.

7. Create a new release note and submit the updated version.

Why this process exists: Capacitor apps package your web app inside native shells, so every mobile release needs:
- updated web build
- Capacitor sync
- native release build
- store upload

## 11. Recommended pre-release checklist

1. Run TypeScript validation.

```bash
npm run lint
```

2. Run a production web build.

```bash
npm run build
```

3. Sync Capacitor projects.

```bash
npx cap sync
```

4. Verify Android project files exist:
   - `android/gradlew`

5. Verify iOS workspace exists:
   - `ios/App/App.xcworkspace`

6. Verify native source assets exist:
   - `assets/icon.png`
   - `assets/icon-foreground.png`
   - `assets/splash.png`

7. Test on at least one Android phone and one iPhone before store submission.

## 12. Quick reference

1. Install dependencies

```bash
npm install
```

2. Run the web app locally

```bash
npm run dev
```

3. Lint the project

```bash
npm run lint
```

4. Build the web app

```bash
npm run build
```

5. Build and sync Android

```bash
npm run build:android
```

6. Build and sync iOS

```bash
npm run build:ios
```

7. Sync both native platforms

```bash
npm run cap:sync
```

8. Generate Android signing keystore

```bash
keytool -genkey -v -keystore expense-tracker-release.keystore -alias expensetracker -keyalg RSA -keysize 2048 -validity 25000 -dname "CN=Praful Reddy, OU=Mobile, O=ExpenseTracker, L=YourCity, ST=YourState, C=IN"
```
