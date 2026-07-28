# Architecture Overview

## System Context

Digi-Switchride is an electric vehicle rental platform targeting the Indian market. Customers use native mobile apps to locate hubs, complete KYC, book vehicles, ride, and pay. Administrators manage fleet, customers, and operations via a web portal.

**Tech stack aligned with DigiTrack:** NestJS + MongoDB (Mongoose) monorepo.

## Components

| Component | Technology | Purpose |
|-----------|-----------|---------|
| Platform API | NestJS 11 + Mongoose 8 | Business logic, REST API |
| Database | MongoDB 7 / Azure Cosmos DB MongoDB API | Primary datastore |
| Admin Portal | Next.js 15 + TypeScript | Operations management |
| Customer Android | Kotlin + Jetpack Compose | Customer mobile app |
| Customer iOS | Swift + SwiftUI | Customer mobile app |
| Redis | Azure Cache (optional) | Sessions, availability cache |
| Azure Blob Storage | Azure | KYC documents, exports |
| Azure IoT Hub | Azure | Device connectivity |

## Module Boundaries (Backend)

```
apps/api/src/
├── auth/           — OTP auth, JWT, refresh tokens
├── customers/      — Profiles, KYC submissions
├── fleet/          — Hubs (2dsphere geo), vehicles
├── bookings/       — Booking lifecycle, rides, pricing
├── payments/       — Razorpay, promotions, reports, admin
├── support/        — Tickets
└── iot/            — Command dispatch, telemetry ingestion
```

Schemas are centralized in `apps/api/src/schemas/` (DigiTrack pattern).

## Data Flow: Ride Lifecycle

1. Customer searches nearby hubs (`$geoNear` / haversine on MongoDB GeoJSON)
2. Selects vehicle and creates booking
3. Razorpay payment order created
4. Customer starts ride → API validates → IoT unlock command
5. Telemetry streams GPS/battery during ride
6. Customer ends ride → IoT lock → fare calculated → payment captured

## Deployment

- **Edge:** Azure API Management + Front Door
- **Compute:** Azure App Service (Node.js 20 LTS)
- **Data:** Azure Cosmos DB (MongoDB API), Redis, Blob Storage
- **IoT:** Azure IoT Hub
- **Observability:** Application Insights + Log Analytics

## Environments

| Environment | Purpose |
|-------------|---------|
| dev | Local MongoDB + Azure dev resources |
| staging | Pre-production testing |
| prod | Production (Central India region) |
