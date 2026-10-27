# Digi-Switchride iOS App

Native Swift + SwiftUI rider app.

The API host is **not** on the login screen. It is set in `DigiSwitchride/Config/AppConfig.swift`:

```swift
static let apiBaseURL = "https://fleetel-switchride-pmxt5.ondigitalocean.app/api/v1"
```

`Info.plist` allows HTTP (ATS) so this IP:4000 URL can load.

## There is no installable `.ipa` in this repo

Apple does not allow sideloading an unsigned IPA the way Android uses an APK.

| What you want | How |
|---------------|-----|
| Your iPhone (POC) | Mac + Xcode → open the sources → **Signing & Capabilities** → your Team → Run on the device |
| Testers | Apple Developer Program + **TestFlight** (upload a signed IPA from Xcode Archive) |
| App Store | Same, plus App Store Connect review |

The Xcode project file is not checked in. On a Mac: **File → New → Project → App**, use bundle sources under `DigiSwitchride/`, add every `.swift` file and `Info.plist`.

You **cannot** produce a working iOS install from Windows.

## Make it work

1. Confirm `https://fleetel-switchride-pmxt5.ondigitalocean.app/api/health` in Safari on the iPhone.
2. Public access is **HTTPS on 443**. Do not use port 4000 on this hostname.
3. Trust the developer certificate on the iPhone: Settings → General → VPN & Device Management.
