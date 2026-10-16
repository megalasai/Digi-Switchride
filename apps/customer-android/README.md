# Digi-Switchride Rider Android App

Rider mobile app: home dashboard, vehicle, payments, rental plan, KYC, support, and on-demand hub booking.

## Requirements

- Android Studio Ladybug or newer
- JDK 17
- Android SDK 35

## Sync / dependency fixes

This project uses **AGP 8.7.3** and **Gradle 8.10.2** (stable with Android Studio). If sync fails:

1. **File → Invalidate Caches → Restart**
2. **File → Sync Project with Gradle Files**
3. Ensure **JDK 17** is set: *Settings → Build → Gradle → Gradle JDK*

Google Maps was removed from dependencies (not required for current UI) to avoid Play Services sync issues.

## API URL

| Environment | API server field |
|-------------|------------------|
| Emulator | `10.0.2.2:4000` |
| Physical phone | Your PC IP from `ipconfig`, e.g. `192.168.0.50:4000` |

Backend base path: `/api/v1`

Start API from repo root:

```cmd
npm run dev
```

## Run on emulator

1. Open `apps/customer-android` in Android Studio
2. Sync Gradle
3. Run **app** on an API 26+ emulator
4. Register / sign in
5. Use bottom tabs: **Home**, **Vehicle**, **Pay**, **Plan**, **More**

## Feature map (spec → app)

| Spec area | Where in app |
|-----------|----------------|
| Home (plan, wallet, dues, alerts) | **Home** tab |
| My Vehicle / breakdown / service | **Vehicle** tab |
| Payments & wallet | **Pay** tab |
| Rental plan | **Plan** tab |
| Profile, KYC, agreements, stations, support, feedback, refer | **More** menu |
| On-demand hub book / start / end ride | **More → Book a ride** |

## Admin setup for testing

1. Login admin web as SuperAdmin
2. Create **hub** (Nagpur coords default), **vehicles** (Available, assigned to hub)
3. Create **rental plans**, assign rider vehicle/plan if using rental home data
4. Approve rider **KYC** after mobile submit

## Unit test (optional)

```cmd
cd apps\customer-android
gradlew testDebugUnitTest
```

Tests `ApiSettings` URL normalization without a device.
