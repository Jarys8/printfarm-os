# Desktop and Android builds

The web app is wrapped twice from the same `dist/` output:

- **Windows** — Electron, packaged by electron-builder as a portable `.exe`
- **Android** — Capacitor, packaged by Gradle as a debug-signed `.apk`

## Windows

```bash
npm install
npm run dist:win
```

Output: `release/PrintFarm-OS-1.0.1-portable.exe` (about 75 MB, Windows x64).

The script disables `signAndEditExecutable` so packaging also works on Windows
accounts without the symlink privilege needed by electron-builder's signing
tools. The app is unsigned, so SmartScreen may ask for confirmation on first
run. Run `npm run electron` to launch the desktop build during development.

Electron loads `dist/index.html` from disk. Farm data is stored in the Electron
profile (`localStorage`), separate from the browser copy.

## Android

Requirements:

- JDK 17 (`JAVA_HOME`)
- Android SDK with `platforms;android-34` and `build-tools;34.0.0`
  (`ANDROID_HOME`, or `sdk.dir` in `android/local.properties`)

```bash
npm run android:apk
```

Output: `android/app/build/outputs/apk/debug/app-debug.apk` (about 4 MB).

The APK is **debug-signed**, which is fine for sideloading but not for Google
Play. For a store build, create a release keystore and configure
`android/app/build.gradle` with your signing config, then run
`gradlew assembleRelease`.

Capacitor serves the app from `dist/` inside a WebView; `localStorage` persists
on the device. App ID: `com.jarys8.printfarmos`, label: “PrintFarm OS”.

## Release upload

Both artifacts are attached to the GitHub release for the current version:

https://github.com/Jarys8/printfarm-os/releases

Artifacts are intentionally kept out of git (`release/`, `*.apk` in
`.gitignore`); the repository contains the source and build configuration.
