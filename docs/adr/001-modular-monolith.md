# ADR-001: Modular Monolith Architecture

## Status

Accepted

## Context

Digi-Switchride is a greenfield platform requiring rapid MVP delivery with multiple bounded contexts (Identity, Fleet, Bookings, Payments, IoT). We need to choose between microservices and monolith for the initial backend.

## Decision

Start with a **modular monolith** in .NET 8 with clear module boundaries, evolving to microservices when specific modules require independent scaling.

## Rationale

- Faster MVP delivery with single deployable unit
- Simpler local development and debugging
- Module folders enforce boundaries (no cross-module direct DB access)
- Azure App Service hosting is cost-effective for early stage
- Split points identified: Payments, IoT Gateway (already separate), Booking/Ride

## Consequences

- Single deployment pipeline initially
- Must enforce module boundaries via code review and architecture tests
- Migration path: extract hot modules to separate App Services when load demands
