# Reference: Rydzo Rider APK (`rydzo-rider-release.apk`)

Source file (local): `C:\Users\Megala\Downloads\rydzo-rider-release.apk`

This is **not** part of the Digi-Switchride build. Use it only as a **UX and feature checklist** for Fleetel Switchride rider apps.

## Technical profile

| Item | Value |
|------|--------|
| Package | `com.ekkogroupinc.rider` |
| App label | **Rydzo Rider** |
| Stack | **Capacitor + React** (web bundle in `assets/public/`) |
| Backend (bundle hints) | **Supabase** + mock/demo datasets in JS |
| Min SDK | 23 |
| Target SDK | 35 |
| Notable native plugins | Background geolocation, biometric auth, camera, Play Services location, QR (vendor-qr), XLSX import (admin-style tooling in same bundle) |

## Rider-facing capabilities (from bundled UI strings)

### Core navigation & account

- **Home** / dashboard
- **My Profile** (address, reference contact, password)
- **Sign in** (email/password; biometric support on device)
- **Plan** (Daily / Weekly / Monthly / Corporate / Prepaid)
- **Deposit** and **rent** amounts shown on profile/agreement flows

### Vehicle

- **No vehicle assigned** empty states (matches our Vehicle tab)
- **Maintenance checklist** and **Next service due**
- **Handover** / assignment flows; **scan vehicle QR** (“Point your camera at a vehicle's QR code”)
- Vehicle maintenance types (e.g. brake, shocker oil, greasing) — workshop-oriented

### Payments & wallet

- **Pay Now** / **Pay Online**
- **Payment Due**, **Overdue**, **Next rent due**
- **My QR** / **Payment QR** (staff-uploaded UPI/bank QR for rent)
- **Full wallet ledger**; pay rent **from wallet balance**
- **Payment reminders** (push-style messaging in product copy)

### Operations (rider-initiated)

- **BREAKDOWN** reporting
- **Field Service**, **General Service**, **Free Service**, **Paid Service**
- **Job cards** / **gate passes** (workshop; rider may see status via ops flow)

### Compliance & growth

- **KYC documents** (upload photo/scan/PDF; Aadhaar, RC, etc.)
- **Rental agreement** generation + **Digio** e-sign
- **Refer a friend**, **referral bonus** on on-time rent

### Other

- Charts/analytics bundles present (likely admin + fleet views in same app build)
- **Insurance** records per vehicle (operator workflow)

## Parity vs Fleetel Switchride (Android `customer-android`)

| Rydzo-style feature | Fleetel Switchride today | Notes |
|---------------------|--------------------------|--------|
| Home dashboard | **Home** tab | Add “next rent due”, payment due banner like Rydzo |
| My Profile | **More → Profile** | OK |
| Plan selection | **Plan** tab | Fixed tenant-scoped plans on API |
| Wallet + ledger | **Pay** tab | OK; add “pay from wallet” clarity |
| Payment QR (UPI) | Partial | Admin/finance QR not exposed as **My QR** screen yet |
| Vehicle + breakdown/service | **Vehicle** tab (buttons → forms) | Aligned with your requested UX |
| Workshop / appointments | **More → Workshop** | Moved out of Vehicle tab |
| KYC upload | **KYC** screen + admin review | OK |
| Agreements + e-sign | **Agreements** list | **Digio** integration not in Nest API yet |
| Refer & earn | **More → Refer** | OK |
| Hub book / active ride | **More → Book a ride** | Switchride-specific |
| Charging stations | **More → Stations** | OK |
| Biometric login | Not yet | Rydzo uses Capacitor biometric plugin |
| Background GPS | Not yet | Rydzo uses foreground location service |
| Scan QR to assign vehicle | Not yet | Could use ML Kit / CameraX + admin QR on vehicle |
| Push notifications | Not yet | Rydzo declares `POST_NOTIFICATIONS` |
| Maintenance checklist on vehicle | Not yet | Needs API fields or ops integration |

## Recommended implementation order (Fleetel)

1. **Dashboard polish** — payment due, next rent date, quick actions (Pay, Vehicle, KYC status).
2. **My QR** — expose tenant payment QR from admin branding/finance config to rider **Pay** tab.
3. **Maintenance / next service** — surface from ops/service APIs on Vehicle card.
4. **Notifications** — FCM + payment reminder events from API.
5. **Biometric app lock** — optional after login (AndroidX Biometric).
6. **Agreement e-sign** — Digio (or similar) webhook flow on API + rider sign screen.
7. **QR handover** — optional; align with hub/fleet assign flows.

## Re-analysing the APK locally

```powershell
# Badging
& "$env:LOCALAPPDATA\Android\Sdk\build-tools\35.0.0\aapt.exe" dump badging "C:\Users\Megala\Downloads\rydzo-rider-release.apk"

# Unzip web UI (Capacitor)
Copy-Item "...\rydzo-rider-release.apk" "$env:TEMP\rydzo.zip"
Expand-Archive "$env:TEMP\rydzo.zip" "$env:TEMP\rydzo-unzipped"
# Main UI bundle: assets\public\assets\index-*.js
```

Do **not** copy Rydzo assets, code, or Supabase keys into Fleetel Switchride — only reproduce **behaviour** against our NestJS `/api/v1/rider/*` APIs.
