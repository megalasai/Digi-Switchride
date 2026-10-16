# ADR-005: Standalone India Location Service

## Status

Accepted

## Context

Rides, hubs, and other Digi-Switchride applications need a locality, district, state, and PIN code for a GPS fix in India. Device altitude is sometimes available and should be returned with that location. The lookup has to stay correct under more than 100,000 requests in 10 minutes, and teams outside the main platform API need to call it without taking a dependency on the rental database.

## Decision

Ship a separate Node.js service at `apps/location`. It is not a module of the NestJS API.

- The HTTP API accepts `latitude`, `longitude`, and optional `altitude` (meters).
- Open data is loaded once into a SQLite database: GeoNames populated places and PIN codes for India, plus a Natural Earth boundary.
- Each lookup finds the nearest place and PIN code with a SQLite R-tree. Names for states and districts come from that same database.
- The database file is read-only at runtime, so the service can be copied onto its own host or scaled out as identical containers.
- Callers identify themselves with API keys (`LOCATION_API_KEYS`) when the deployment is shared.
- A small in-process cache covers repeated coordinates. With the cache turned off, one process still clears the 100,000-request / 10-minute bar.

## Consequences

- The location service has its own port, database, and deploy pipeline.
- Node.js 22.13 or newer is required because the service uses the built-in `node:sqlite` module.
- Place names must be attributed to GeoNames (CC-BY-4.0).
- Elevation is the matched locality's elevation, not a terrain model of the exact coordinate.
- The India/not-India decision follows the Natural Earth boundary.
