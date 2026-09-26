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
│   └── DigiSwitchrideApp.swift      # App entry point + tab navigation
├── Theme/
│   └── AppTheme.swift               # Brand colors and button styles
├── Components/
│   └── Components.swift             # Reusable UI components
├── Services/
│   └── APIService.swift             # REST API client + AuthManager
└── Views/
    └── Screens.swift                # All UI screens
```

## Features

- Modern SwiftUI design matching Android (green EV brand, cards, bottom tabs)
- Username/password login and registration
- KYC document upload
- Nearby hub discovery with map placeholder
- Vehicle booking and ride start/end
- Ride history empty state
- Support tickets
- Profile with KYC shortcuts

## API

Connects to Platform API at `/api/v1` — see `contracts/openapi/platform-v1.yaml`.

For simulator: use `http://localhost:4000/api/v1`
For device: use your machine's local IP (e.g. `http://192.168.x.x:4000/api/v1`).
