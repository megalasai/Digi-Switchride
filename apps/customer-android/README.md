# Digi-Switchride Rider Android App

Rider mobile app: home dashboard, vehicle, payments, rental plan, KYC, support, and on-demand hub booking.

The API host is **not** on the login screen. It is set in configuration:

- `gradle.properties` → `API_BASE_URL=http://162.159.140.98:4000/api/v1`

## Requirements

- Android Studio Ladybug or newer
- JDK 17
- Android SDK 35

## Build the APK you install on a phone

From `apps/customer-android`:

```cmd
gradlew.bat assembleDebug
```

Install this file:

**`apps/customer-android/app/build/outputs/apk/debug/app-debug.apk`**

On the phone: enable **Install from unknown sources** (or “Install via USB”), copy the APK, open it, install. There is no Play Store listing yet — use this debug APK.

Release / Play Store would be `assembleRelease` + a keystore. That is not set up; use **debug** for the POC.

## Run from Android Studio

1. Open `apps/customer-android`
2. Sync Gradle
3. Run **app** on a device (API 26+)
4. Sign in with organization slug (for example `digi-switchride`)

## Make it work

1. API must be reachable: `http://162.159.140.98:4000/api/health` from the phone’s browser.
2. If that fails, App Platform is probably only on **HTTPS :443**, not raw **:4000**. Then set `API_BASE_URL` to `https://YOUR-APP.ondigitalocean.app/api/v1`, rebuild, and reinstall the APK.
3. API CORS already allows mobile clients. Cluster trusted sources must allow the API.

## Feature map

| Spec area | Where in app |
|-----------|----------------|
| Home | **Home** tab |
| My Vehicle | **Vehicle** tab |
| Payments | **Pay** tab |
| Rental plan | **Plan** tab |
| Profile, KYC, support | **More** |
| Book a ride | **More → Book a ride** |
