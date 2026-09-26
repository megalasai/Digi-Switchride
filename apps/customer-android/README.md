# Digi-Switchride Android App

Native Kotlin + Jetpack Compose customer application.

## Requirements

- Android Studio Ladybug or later
- JDK 17
- Android SDK 35

## Setup

1. Open `apps/customer-android` in Android Studio
2. Set `MAPS_API_KEY` in `gradle.properties`
3. Sync Gradle and run on emulator or device

## Features

- Modern Material 3 UI with bottom navigation (Explore, History, Support, Profile)
- Username/password authentication with secure token storage (DataStore)
- KYC document upload flow
- Nearby hub map placeholder and vehicle listing
- Book → Start Ride → End Ride flow
- Ride history and support tickets

## API Configuration

Default API URL for emulator: `http://10.0.2.2:4000/api/v1`

**Physical phone:** `10.0.2.2` does not work. On the login screen set **API server** to your PC's LAN IP, e.g. `192.168.0.50:4000` (find it with `ipconfig` on Windows). Phone and PC must be on the same Wi‑Fi. Start the API with `npm run dev` from the repo root.

Change in `app/build.gradle.kts` → `buildConfigField("API_BASE_URL", ...)`

## Architecture

- **MVVM** with ViewModels and StateFlow
- **Hilt** for dependency injection
- **Retrofit** for API calls
- **Navigation Compose** for screen routing
