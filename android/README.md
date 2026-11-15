# VIT Connect — Android App (Live Deployed Web Backend)

This Android project builds the native **VIT Connect** APK (`edu.vit.connect`) that runs directly against the deployed production website (`https://udp-based-video-conferencing.vercel.app`) and Render backend — **no local server required**.

## Features
- **Live Cloud Connection**: Loads `https://udp-based-video-conferencing.vercel.app` directly (configured in [`app/build.gradle`](app/build.gradle) via `DEPLOYED_WEB_URL`), so any frontend/backend update deployed to Vercel/Render automatically updates the Android app without rebuilding the APK.
- **Native WebRTC Camera & Microphone Bridging**: Requests Android runtime permissions (`CAMERA`, `RECORD_AUDIO`, `MODIFY_AUDIO_SETTINGS`) and automatically grants `WebChromeClient.onPermissionRequest` inside [`MainActivity.java`](app/src/main/java/edu/vit/connect/MainActivity.java).
- **Deep Link Support**: Clicking a `https://udp-based-video-conferencing.vercel.app/conference/...` link on Android opens the meeting directly inside the native app.
- **Keep-Awake During Calls**: Sets `FLAG_KEEP_SCREEN_ON` so the phone screen does not lock while in a video meeting.

## How to Get / Build the APK

### Option 1: Automatic Cloud Build via GitHub Actions (No Android Studio needed)
1. Push this repository to GitHub.
2. Go to the **Actions** tab → **Build VIT Connect Android APK** ([`.github/workflows/build-android-apk.yml`](../.github/workflows/build-android-apk.yml)).
3. Click **Run workflow** (or let it run on push) and download **`VIT-Connect-Android-APK`** (`app-debug.apk`).

### Option 2: Build Locally in Android Studio
1. Open the `android/` directory in **Android Studio**.
2. Wait for Gradle Sync to finish.
3. Click **Build → Build Bundle(s) / APK(s) → Build APK(s)**.
4. Output APK: `android/app/build/outputs/apk/debug/app-debug.apk`.

### Option 3: Install Directly from Chrome on Android (PWA / WebAPK)
1. Push the updated frontend (`public/manifest.webmanifest`, `public/sw.js`, `public/icon-192.png`, `public/icon-512.png`) to Vercel.
2. Open `https://udp-based-video-conferencing.vercel.app` in **Chrome on Android**.
3. Tap the Chrome menu (`⋮`) → **Install app** (or **Add to Home screen**). Android compiles and installs a standalone full-screen WebAPK directly on the phone.
