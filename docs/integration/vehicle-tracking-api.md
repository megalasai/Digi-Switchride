# MoventraX vehicle tracking API

Use this guide to connect an external product (for example a school or operations app) to live and historical GPS from MoventraX.

**Base URL (production):** `https://fleetel-switchride-pmxt5.ondigitalocean.app/api`  
**Base URL (local):** `http://localhost:4000/api`

All partner calls send JSON over HTTPS. Dates are ISO-8601 UTC (`2026-11-15T08:00:00.000Z`).

## 1. What you receive from MoventraX

A MoventraX operator creates your **application** (slug such as `schoolapplication`) and gives you:

| Item | Example |
|------|---------|
| `applicationId` | `schoolapplication` |
| API key | `mtx_…` (shown once; store it like a password) |

The operator then maps:

1. **Tenants (companies)** that your app may see  
2. **IoT devices / vehicles** inside those companies (optional; if omitted, every device in the mapped tenants is included)

Your key only unlocks that `applicationId`. You cannot read another application’s fleet.

## 2. Authentication

Send the key on every partner request:

```http
X-Api-Key: mtx_your_key_here
```

`Authorization: Bearer mtx_your_key_here` is also accepted.

A `401` means the key is missing, wrong, disabled, or does not match the `applicationId` in the URL.

## 3. Partner APIs

Replace `{applicationId}` with your slug.

### 3.1 Tenant mapping

Returns the companies linked to your application.

```http
GET /v1/tracking/{applicationId}/tenants
```

```json
{
  "applicationId": "schoolapplication",
  "items": [
    {
      "applicationId": "schoolapplication",
      "tenantId": "6ac4b568cb1a4bc2181cf1a8",
      "tenantName": "Acme Fleet"
    }
  ]
}
```

### 3.2 Device, vehicle, tenant, and application mapping

```http
GET /v1/tracking/{applicationId}/assets
```

```json
{
  "applicationId": "schoolapplication",
  "items": [
    {
      "applicationId": "schoolapplication",
      "tenantId": "6ac4b568cb1a4bc2181cf1a8",
      "tenantName": "Acme Fleet",
      "deviceId": "864793076543210",
      "vehicleId": "67ab...",
      "vehicleRegistration": "KA01AB1234",
      "displayName": "Bus 12",
      "vendorType": "WanWay",
      "connectionStatus": "Connected"
    }
  ]
}
```

If no device rows were stored, this list is empty even when tenants are mapped. Live endpoints still return every device in those tenants until explicit device mappings exist.

### 3.3 Live data for all mapped vehicles

```http
GET /v1/tracking/{applicationId}/live
GET /v1/tracking/{applicationId}/live?tenantId={tenantId}
```

| Query | Result |
|-------|--------|
| `applicationId` only | Every device linked to the application (all mapped tenants) |
| `applicationId` + `tenantId` | Devices for that company only |

```json
{
  "applicationId": "schoolapplication",
  "tenantId": null,
  "count": 2,
  "generatedAt": "2026-11-15T08:41:00.000Z",
  "items": [
    {
      "applicationId": "schoolapplication",
      "tenantId": "6ac4b568cb1a4bc2181cf1a8",
      "tenantName": "Acme Fleet",
      "deviceId": "864793076543210",
      "vehicleId": "67ab...",
      "vehicleRegistration": "KA01AB1234",
      "vehicleType": "ECar",
      "vehicleStatus": "InRide",
      "displayName": "Bus 12",
      "vendorType": "WanWay",
      "imei": "864793076543210",
      "connectionStatus": "Connected",
      "lastSeenAt": "2026-11-15T08:40:51.000Z",
      "lastLocation": { "lat": 12.9784, "lng": 77.6408 },
      "lastPlace": "Indiranagar, Bengaluru",
      "speedKmh": 32,
      "ignition": "On",
      "batteryPercent": 86,
      "batteryVoltage": 54.2,
      "odometerKm": 412,
      "immobilised": false,
      "vendorStatus": "Moving"
    }
  ]
}
```

Poll this endpoint for a map of the whole fleet. Suggested interval: **5–15 seconds**.

### 3.4 Live tracking for one vehicle

```http
GET /v1/tracking/{applicationId}/live/vehicle?deviceId={deviceId}
GET /v1/tracking/{applicationId}/live/vehicle?vehicleId={vehicleId}
```

Provide **either** `deviceId` **or** `vehicleId`. The device must be mapped to your application.

```json
{
  "applicationId": "schoolapplication",
  "generatedAt": "2026-11-15T08:41:00.000Z",
  "item": { }
}
```

`item` uses the same fields as each row in §3.3.

### 3.5 History tracking for one vehicle

```http
GET /v1/tracking/{applicationId}/history?deviceId={deviceId}&startDateTime={from}&endDateTime={to}
GET /v1/tracking/{applicationId}/history?vehicleId={vehicleId}&startDateTime={from}&endDateTime={to}
```

| Query | Required | Notes |
|-------|----------|--------|
| `deviceId` or `vehicleId` | Yes (one of them) | Must be mapped to the application |
| `startDateTime` | Yes | ISO-8601 |
| `endDateTime` | Yes | Must be after start; window max **31 days** |

```json
{
  "applicationId": "schoolapplication",
  "deviceId": "864793076543210",
  "vehicleId": "67ab...",
  "startDateTime": "2026-11-14T00:00:00.000Z",
  "endDateTime": "2026-11-15T00:00:00.000Z",
  "count": 180,
  "truncated": false,
  "items": [
    {
      "at": "2026-11-14T06:01:12.000Z",
      "lat": 12.9784,
      "lng": 77.6408,
      "speedKmh": 28,
      "ignition": "On",
      "deviceId": "864793076543210",
      "vehicleId": "67ab..."
    }
  ]
}
```

At most **5,000** points are returned. If `truncated` is `true`, split the time range and call again.

GPS history is retained for **180 days**.

## 4. Example (curl)

```bash
BASE=https://fleetel-switchride-pmxt5.ondigitalocean.app/api
APP=schoolapplication
KEY=mtx_your_key_here

curl -s -H "X-Api-Key: $KEY" "$BASE/v1/tracking/$APP/tenants"
curl -s -H "X-Api-Key: $KEY" "$BASE/v1/tracking/$APP/assets"
curl -s -H "X-Api-Key: $KEY" "$BASE/v1/tracking/$APP/live"
curl -s -H "X-Api-Key: $KEY" "$BASE/v1/tracking/$APP/live?tenantId=TENANT_ID"
curl -s -H "X-Api-Key: $KEY" "$BASE/v1/tracking/$APP/live/vehicle?deviceId=DEVICE_ID"
curl -s -H "X-Api-Key: $KEY" \
  "$BASE/v1/tracking/$APP/history?deviceId=DEVICE_ID&startDateTime=2026-11-14T00:00:00.000Z&endDateTime=2026-11-15T00:00:00.000Z"
```

## 5. HTTP status codes

| Code | Meaning |
|------|---------|
| 200 | Success |
| 400 | Missing/invalid query (for example no `deviceId`, bad dates) |
| 401 | Missing or invalid API key |
| 404 | Application, device, or vehicle not mapped |
| 409 | Duplicate `applicationId` (create only) |

## 6. Operator setup (MoventraX admin)

These calls use an **admin JWT** (`Authorization: Bearer <admin token>`), not the partner key. SuperAdmin or Administrator.

### 6.1 Register the external application (stores MongoDB `tracking_partner_apps`)

```http
POST /v1/admin/tracking-partners
Content-Type: application/json

{ "applicationId": "schoolapplication", "name": "School tracking", "notes": "Bengaluru schools" }
```

The response includes `apiKey` **once**. Share it with the customer over a secure channel. Prefix `apiKeyPrefix` is stored for support; the full key is hashed.

To issue a new key: `POST /v1/admin/tracking-partners/{applicationId}/rotate-key`.

### 6.2 Map tenants (stores `tracking_partner_tenants`)

```http
PUT /v1/admin/tracking-partners/schoolapplication/tenants
Content-Type: application/json

{ "tenantIds": ["6ac4b568cb1a4bc2181cf1a8"] }
```

Read back: `GET /v1/admin/tracking-partners/schoolapplication/tenants`.

### 6.3 Map devices and vehicles (stores `tracking_partner_assets`)

```http
PUT /v1/admin/tracking-partners/schoolapplication/assets
Content-Type: application/json

{
  "items": [
    {
      "tenantId": "6ac4b568cb1a4bc2181cf1a8",
      "deviceId": "864793076543210",
      "vehicleId": "67ab..."
    }
  ]
}
```

`vehicleId` is optional; MoventraX fills it from the linked IoT device when present.

Read back: `GET /v1/admin/tracking-partners/schoolapplication/assets`.

If this list is empty, live queries use **all IoT devices in the mapped tenants**.

### 6.4 List applications

```http
GET /v1/admin/tracking-partners
PATCH /v1/admin/tracking-partners/{applicationId}
```

`PATCH` can set `"status": "Disabled"` to cut off a partner without deleting mappings.

## 7. MongoDB collections

| Collection | Purpose |
|------------|---------|
| `tracking_partner_apps` | applicationId, name, status, hashed API key |
| `tracking_partner_tenants` | applicationId ↔ tenantId |
| `tracking_partner_assets` | applicationId ↔ tenantId ↔ deviceId ↔ vehicleId |
| `iot_devices` | Latest telemetry |
| `vehicles` | Registration, status, last place |
| `gps_track_points` | History breadcrumbs (TTL 180 days) |

## 8. Integration checklist

1. Ask MoventraX for `applicationId` and API key.  
2. Call `GET .../tenants` and store `tenantId` values you need.  
3. Call `GET .../assets` (or live with no `tenantId`) to bind your map markers to `deviceId` / `vehicleId`.  
4. Poll `GET .../live` for the fleet map.  
5. Poll `GET .../live/vehicle` when a user opens one vehicle.  
6. Call `GET .../history` for playback (max 31 days per request).

Do not embed the API key in a public mobile app. Keep it on your backend and proxy map requests from your application.
