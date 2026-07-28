# Digi-Switchride iOS App

Native Swift + SwiftUI customer application for the Digi-Switchride platform.

## Requirements

- Xcode 15+
- iOS 17.0+
- macOS for building

## Setup

1. Open `DigiSwitchride.xcodeproj` in Xcode (create project from these sources)
2. Set your development team in Signing & Capabilities
3. Add Google Maps API key in Info.plist if using map view
4. Update API base URL in `Services/APIService.swift` for your environment

## Project Structure

```
DigiSwitchride/
├── App/
│   └── DigiSwitchrideApp.swift      # App entry point
├── Services/
│   └── APIService.swift             # REST API client + AuthManager
└── Views/
    └── Screens.swift                # All UI screens
```

## Features

- OTP login
- KYC document upload
- Nearby hub discovery
- Vehicle booking and ride start/end
- Ride history
- Support tickets
- Profile management

## API

Connects to Platform API at `/v1` — see `contracts/openapi/platform-v1.yaml`.

For simulator: use `http://localhost:5000/v1`
For device: use your machine's local IP.
