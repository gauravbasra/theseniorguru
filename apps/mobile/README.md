# TheSeniorguru Mobile App

React Native / Expo dev-client mobile app for Android and iOS.

## Local Android build

```bash
cd apps/mobile
npm install
npm run patch:native-compat
cd android
./gradlew :app:assembleDebug
```

Debug APK output:

```text
apps/mobile/android/app/build/outputs/apk/debug/app-debug.apk
```

## Local API during development

The mobile app expects the local API to be reachable from Android via adb reverse:

```bash
adb reverse tcp:4187 tcp:4187
adb reverse tcp:8081 tcp:8081
```

Run the local JSON API from the repo root:

```bash
cd apps/mobile-api
PORT=4187 node server.js
```

## Safety note

This app includes prototype/native wiring for location, notifications, Health Connect, wearable telemetry, and SOS workflows. Treat all healthcare safety behavior as development-stage until production clinical/legal review, device certification review, and emergency-routing validation are complete.
