# ADR-002: Native Mobile Applications

## Status

Accepted

## Context

Customer mobile apps are the primary interface. We need to choose between cross-platform (Flutter/React Native) and fully native (Kotlin/Swift) development.

## Decision

Build **fully native** applications:
- Android: Kotlin + Jetpack Compose + MVVM + Hilt
- iOS: Swift + SwiftUI + MVVM

## Rationale

- Best performance for map-heavy, real-time ride tracking
- Native camera/KYC SDK integration (Digio/Signzy)
- Platform-specific UX patterns (Material Design / Human Interface Guidelines)
- Razorpay native SDK support on both platforms
- Team preference for native development

## Consequences

- Two codebases to maintain (mitigated by shared OpenAPI contract)
- Parallel feature development required
- Separate CI pipelines for Android and iOS
