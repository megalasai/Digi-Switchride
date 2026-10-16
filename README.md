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
| **Location API** | Standalone Fastify + SQLite (`apps/location`) |
| **Telemetry API** | Standalone Fastify + SQLite (`apps/telemetry`) |

See [docs/architecture/overview.md](docs/architecture/overview.md) for full details.

## Repository Structure

```
apps/
  api/                  # NestJS backend (@digi-switchride/api)
  location/             # India reverse-geocoding API (hosted separately)
  telemetry/            # GPS telemetry API (hosted separately, like location)
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

### India location service

A separate app resolves latitude, longitude, and optional altitude to a locality, district, state, and PIN code. Other applications call it over HTTP. It keeps its own SQLite database, built from GeoNames and Natural Earth, and is sized for more than 100,000 requests in 10 minutes.

```bash
npm run seed:location
npm run dev:location
```

Location API: `http://localhost:4100/v1/locations/reverse`. See [apps/location/README.md](apps/location/README.md).

### GPS telemetry service

A separate app, hosted like the location API. Configuration is in SQLite; GPS is stored in the main MongoDB. It pulls vendor GPS APIs and accepts HTTP, TCP, and MQTT, and calls the location API over HTTP for place names.

```bash
npm run dev:telemetry
```

Telemetry API: `http://localhost:4200`. See [apps/telemetry/README.md](apps/telemetry/README.md).

### API Documentation

OpenAPI specs: [platform](contracts/openapi/platform-v1.yaml), [location](contracts/openapi/location-v1.yaml), [telemetry](contracts/openapi/telemetry-v1.yaml)

## License

Proprietary — All rights reserved.
