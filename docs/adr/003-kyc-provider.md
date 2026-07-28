# ADR-003: KYC Provider Selection

## Status

Accepted (pending vendor contract)

## Context

India-first launch requires Aadhaar, PAN, and Driving Licence verification compliant with UIDAI regulations and DPDP Act 2023.

## Decision

Integrate a **licensed KYC aggregator** — primary candidates: **Digio** or **Signzy**.

Implementation approach:
- Mobile apps capture documents via camera
- Backend stores metadata + encrypted blob references
- KYC provider API handles verification (Aadhaar XML/DigiLocker, PAN NSDL, DL RTO)
- Admin portal provides manual review queue for edge cases

## Rationale

- Direct Aadhaar integration requires UIDAI license (complex)
- KYC aggregators are pre-licensed and provide unified APIs
- Digio and Signzy both support India document types with SDK options

## Consequences

- Vendor dependency for KYC verification
- Per-verification cost model
- Must implement consent logging and data minimization (mask Aadhaar)
- Fallback: manual admin review when API verification fails
