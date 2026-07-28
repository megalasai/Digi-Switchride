# Digi-Switchride Platform

Electric vehicle rental platform — app-based e-scooter/e-bike sharing for India.

## Architecture

Aligned with [DigiTrack](https://github.com) stack:

| Layer | Technology |
|-------|-----------|
| **Backend** | NestJS 11 + Mongoose 8 |
| **Database** | MongoDB 7 (local) / Azure Cosmos DB MongoDB API (prod) |
| **Admin Portal** | Next.js 15 + TypeScript + Tailwind |
| **Customer Android** | Kotlin + Jetpack Compose + Hilt |
| **Customer iOS** | Swift + SwiftUI |
| **IoT** | Azure IoT Hub + adapter layer (telemetry via NestJS API) |

See [docs/architecture/overview.md](docs/architecture/overview.md) for full details.

## Repository Structure

```
apps/
  api/                  # NestJS backend (@digi-switchride/api)
  admin-web/            # Next.js admin portal
  customer-android/     # Kotlin + Jetpack Compose
  customer-ios/         # Swift + SwiftUI
packages/
  shared/               # Shared TypeScript types (@digi-switchride/shared)
iot/
  simulator/            # Dev vehicle simulator (Node)
contracts/
  openapi/              # API contract (OpenAPI 3.1)
infra/
  bicep/                # Azure infrastructure (Cosmos DB, App Service, IoT Hub)
docs/
```

## Getting Started

### Prerequisites

- Node.js 20+
- Docker Desktop (for local MongoDB)
- Android Studio (for Android app)
- Xcode 15+ (for iOS app, macOS only)

### Local Development

```bash
# Install dependencies
npm install

# Start MongoDB
docker compose up -d

# Configure API
cp apps/api/.env.example apps/api/.env

# Run backend + admin portal
npm run dev

# Or run individually
npm run dev:api
npm run dev:admin
```

API runs at `http://localhost:4000/api` — routes are prefixed `/api/v1/...`

### API Documentation

OpenAPI spec: [contracts/openapi/platform-v1.yaml](contracts/openapi/platform-v1.yaml)

## License

Proprietary — All rights reserved.
