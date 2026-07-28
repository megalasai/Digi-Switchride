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

- OTP authentication with secure token storage (DataStore)
- KYC document upload flow
- Nearby hub map and vehicle listing
- Book → Start Ride → End Ride flow
- Ride history and support tickets
- Razorpay payment integration (checkout SDK included)

## API Configuration

Default API URL for emulator: `http://10.0.2.2:5000/v1`

Change in `app/build.gradle.kts` → `buildConfigField("API_BASE_URL", ...)`

## Architecture

- **MVVM** with ViewModels and StateFlow
- **Hilt** for dependency injection
- **Retrofit** for API calls
- **Navigation Compose** for screen routing
