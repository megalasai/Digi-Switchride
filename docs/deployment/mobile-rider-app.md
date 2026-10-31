# Rider mobile apps (Android / iOS)

Production API (DigitalOcean App Platform):

`https://fleetel-switchride-pmxt5.ondigitalocean.app/api/v1`

Health check from a phone browser:

`https://fleetel-switchride-pmxt5.ondigitalocean.app/api/health`

## Android

- API URL is **compile-time only** (`apps/customer-android/gradle.properties` → `API_BASE_URL`). The login screen does not expose server IP or host settings.
- Build: `cd apps/customer-android && ./gradlew assembleDebug`
- APK: `app/build/outputs/apk/debug/app-debug.apk`
- CI uploads the same APK as a GitHub Actions artifact (`rider-app-debug-apk`).

To point a **local debug** build at your machine, temporarily change `API_BASE_URL` in `gradle.properties` to `http://10.0.2.2:4000/api/v1` (emulator) and rebuild. Debug builds allow cleartext HTTP; release builds require HTTPS.

## iOS

Set `apiBaseURL` in `apps/customer-ios` to the same production `/api/v1` URL (see `apps/customer-ios/README.md`).

## Backend

Mobile clients call the same NestJS routes as documented in OpenAPI (`contracts/openapi/platform-v1.yaml`). CORS does not apply to native apps; ensure the App Platform ingress exposes `/api` to the public internet.

Riders must register/sign in with a **tenant** (`tenantSlug` / organization). Tenant admins see only their riders; SuperAdmin sees all (optional `X-Tenant-Id` on admin requests).
