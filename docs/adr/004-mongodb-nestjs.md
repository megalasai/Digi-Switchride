# ADR-004: MongoDB + NestJS Backend (DigiTrack Alignment)

## Status

Accepted

## Context

The initial plan specified .NET 8 + PostgreSQL/PostGIS. The team uses DigiTrack (NestJS + Mongoose + MongoDB) and wants consistent tooling across projects.

## Decision

Migrate the backend to **NestJS 11 + Mongoose 8 + MongoDB**, matching DigiTrack patterns:

- npm workspaces monorepo (`apps/api`, `packages/shared`)
- Centralized schemas in `src/schemas/`
- `mongo.config.ts` with SRV-to-standard URI conversion for Windows
- Global API prefix `/api`, routes at `/api/v1/...`
- Azure Cosmos DB MongoDB API for production

Geospatial queries use MongoDB GeoJSON `Point` with `2dsphere` index instead of PostGIS.

## Consequences

- Consistent developer experience with DigiTrack
- Shared patterns for auth, config, deployment
- Legacy .NET backend removed from `services/platform-api/`
- IoT telemetry ingested via NestJS internal endpoint instead of separate .NET gateway
