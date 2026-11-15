# MoventraX vehicle tracking API

Use this guide to connect an external product (for example a school or operations app) to live and historical GPS from MoventraX.

**Base URL (production):** `https://fleetel-switchride-pmxt5.ondigitalocean.app/api`  
**Base URL (local):** `http://localhost:4000/api`

All partner calls send JSON over HTTPS. Dates are ISO-8601 UTC (`2026-11-15T08:00:00.000Z`).

**Postman:** import [`MoventraX-Vehicle-Tracking.postman_collection.json`](./MoventraX-Vehicle-Tracking.postman_collection.json). Set `adminPassword` and run **Admin login**, then **Create tracking application** (saves `apiKey`). Partner requests use production HTTPS by default (`baseUrl`). For local, set `baseUrl` to `http://localhost:4000/api`.

### Sample fleet in this environment

| Field | Value |
|-------|--------|
| `applicationId` | `schoolapplication` (create once with the admin API) |
| `tenantId` | `6ac4b568cb1a4bc2181cf1a8` (`digi-switchride`) |
| `deviceId` | `352312095160753` (KA01AQ6087) |
| `vehicleId` | `6ac4b567cb1a4bc2181cefdb` |
| Demo device | `SIM-TRACK-DEMO` / vehicle `6abb799e25bda6ff2d0c3ac7` (KA01SR9999) |

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
      "tenantName": "Digi-Switchride"
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
      "tenantName": "Digi-Switchride",
      "deviceId": "352312095160753",
      "vehicleId": "6ac4b567cb1a4bc2181cefdb",
      "vehicleRegistration": "KA01AQ6087",
      "displayName": "KA01AQ6087",
      "vendorType": "Track360",
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
      "tenantName": "Digi-Switchride",
      "deviceId": "352312095160753",
      "vehicleId": "6ac4b567cb1a4bc2181cefdb",
      "vehicleRegistration": "KA01AQ6087",
      "vehicleType": "EScooter",
      "vehicleStatus": "Available",
      "displayName": "KA01AQ6087",
      "vendorType": "Track360",
      "imei": "352312095160753",
      "connectionStatus": "Connected",
      "lastSeenAt": "2026-11-15T08:40:51.000Z",
      "lastLocation": { "lat": 13.00520888888889, "lng": 77.50131666666667 },
      "lastPlace": null,
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
  "deviceId": "352312095160753",
  "vehicleId": "6ac4b567cb1a4bc2181cefdb",
  "startDateTime": "2026-11-14T00:00:00.000Z",
  "endDateTime": "2026-11-15T00:00:00.000Z",
  "count": 180,
  "truncated": false,
  "items": [
    {
      "at": "2026-11-14T06:01:12.000Z",
      "lat": 13.00520888888889,
      "lng": 77.50131666666667,
      "speedKmh": 28,
      "ignition": "On",
      "deviceId": "352312095160753",
      "vehicleId": "6ac4b567cb1a4bc2181cefdb"
    }
  ]
}
```

At most **5,000** points are returned. If `truncated` is `true`, split the time range and call again.

GPS history is retained for **180 days**.

## 4. Worked examples (curl and HTTPS)

Host used below is **production HTTPS**. For local, replace the host with `http://localhost:4000`.

```
https://fleetel-switchride-pmxt5.ondigitalocean.app
```

Set these once (create the application first — §6 — and paste `apiKey`):

```bash
BASE=https://fleetel-switchride-pmxt5.ondigitalocean.app/api
APP=schoolapplication
KEY=mtx_paste_your_key
TENANT=6ac4b568cb1a4bc2181cf1a8
DEVICE=352312095160753
VEHICLE=6ac4b567cb1a4bc2181cefdb
```

### 4.1 Tenant mapping

**curl**

```bash
curl -s -H "X-Api-Key: $KEY" "$BASE/v1/tracking/$APP/tenants"
```

**HTTP**

```http
GET /api/v1/tracking/schoolapplication/tenants HTTP/1.1
Host: fleetel-switchride-pmxt5.ondigitalocean.app
X-Api-Key: mtx_paste_your_key
Accept: application/json
```

### 4.2 Device / vehicle / tenant / application mapping

**curl**

```bash
curl -s -H "X-Api-Key: $KEY" "$BASE/v1/tracking/$APP/assets"
```

**HTTP**

```http
GET /api/v1/tracking/schoolapplication/assets HTTP/1.1
Host: fleetel-switchride-pmxt5.ondigitalocean.app
X-Api-Key: mtx_paste_your_key
Accept: application/json
```

### 4.3 Live fleet (all devices for the application)

**curl**

```bash
curl -s -H "X-Api-Key: $KEY" "$BASE/v1/tracking/$APP/live"
```

**HTTP**

```http
GET /api/v1/tracking/schoolapplication/live HTTP/1.1
Host: fleetel-switchride-pmxt5.ondigitalocean.app
X-Api-Key: mtx_paste_your_key
Accept: application/json
```

### 4.4 Live fleet (one tenant)

**curl**

```bash
curl -s -H "X-Api-Key: $KEY" "$BASE/v1/tracking/$APP/live?tenantId=$TENANT"
```

**HTTP**

```http
GET /api/v1/tracking/schoolapplication/live?tenantId=6ac4b568cb1a4bc2181cf1a8 HTTP/1.1
Host: fleetel-switchride-pmxt5.ondigitalocean.app
X-Api-Key: mtx_paste_your_key
Accept: application/json
```

### 4.5 Live one vehicle (deviceId)

**curl**

```bash
curl -s -H "X-Api-Key: $KEY" "$BASE/v1/tracking/$APP/live/vehicle?deviceId=$DEVICE"
```

**HTTP**

```http
GET /api/v1/tracking/schoolapplication/live/vehicle?deviceId=352312095160753 HTTP/1.1
Host: fleetel-switchride-pmxt5.ondigitalocean.app
X-Api-Key: mtx_paste_your_key
Accept: application/json
```

### 4.6 Live one vehicle (vehicleId)

**curl**

```bash
curl -s -H "X-Api-Key: $KEY" "$BASE/v1/tracking/$APP/live/vehicle?vehicleId=$VEHICLE"
```

**HTTP**

```http
GET /api/v1/tracking/schoolapplication/live/vehicle?vehicleId=6ac4b567cb1a4bc2181cefdb HTTP/1.1
Host: fleetel-switchride-pmxt5.ondigitalocean.app
X-Api-Key: mtx_paste_your_key
Accept: application/json
```

### 4.7 History one vehicle

**curl**

```bash
curl -s -H "X-Api-Key: $KEY" \
  "$BASE/v1/tracking/$APP/history?deviceId=$DEVICE&startDateTime=2026-11-01T00:00:00.000Z&endDateTime=2026-11-15T23:59:59.000Z"
```

**HTTP**

```http
GET /api/v1/tracking/schoolapplication/history?deviceId=352312095160753&startDateTime=2026-11-01T00:00:00.000Z&endDateTime=2026-11-15T23:59:59.000Z HTTP/1.1
Host: fleetel-switchride-pmxt5.ondigitalocean.app
X-Api-Key: mtx_paste_your_key
Accept: application/json
```

### 4.8 Postman

1. Open Postman → **Import** → select [`MoventraX-Vehicle-Tracking.postman_collection.json`](./MoventraX-Vehicle-Tracking.postman_collection.json).  
2. Collection variables: `baseUrl` is already `https://fleetel-switchride-pmxt5.ondigitalocean.app/api`. Set `adminPassword`.  
3. Run **Admin login** (saves `adminToken`), then **Create tracking application** (saves `apiKey`).  
4. Run **Map tenants** and **Map devices and vehicles**.  
5. Run the **Partner tracking** folder. Each request is HTTPS against production unless you change `baseUrl`.

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

### 6.1 Admin login

**curl**

```bash
curl -s -X POST https://fleetel-switchride-pmxt5.ondigitalocean.app/api/v1/auth/admin/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@digiswitchride.com","password":"YOUR_ADMIN_PASSWORD"}'
```

**HTTP**

```http
POST /api/v1/auth/admin/login HTTP/1.1
Host: fleetel-switchride-pmxt5.ondigitalocean.app
Content-Type: application/json
Accept: application/json

{"email":"admin@digiswitchride.com","password":"YOUR_ADMIN_PASSWORD"}
```

Use `accessToken` as `TOKEN` below.

### 6.2 Register the external application (stores MongoDB `tracking_partner_apps`)

**curl**

```bash
curl -s -X POST https://fleetel-switchride-pmxt5.ondigitalocean.app/api/v1/admin/tracking-partners \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"applicationId":"schoolapplication","name":"School tracking","notes":"Partner map"}'
```

**HTTP**

```http
POST /api/v1/admin/tracking-partners HTTP/1.1
Host: fleetel-switchride-pmxt5.ondigitalocean.app
Authorization: Bearer TOKEN
Content-Type: application/json
Accept: application/json

{"applicationId":"schoolapplication","name":"School tracking","notes":"Partner map"}
```

The response includes `apiKey` **once**. Share it with the customer over a secure channel. Prefix `apiKeyPrefix` is stored for support; the full key is hashed.

To issue a new key:

```bash
curl -s -X POST https://fleetel-switchride-pmxt5.ondigitalocean.app/api/v1/admin/tracking-partners/schoolapplication/rotate-key \
  -H "Authorization: Bearer $TOKEN"
```

### 6.3 Map tenants (stores `tracking_partner_tenants`)

**curl**

```bash
curl -s -X PUT https://fleetel-switchride-pmxt5.ondigitalocean.app/api/v1/admin/tracking-partners/schoolapplication/tenants \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"tenantIds":["6ac4b568cb1a4bc2181cf1a8"]}'
```

**HTTP**

```http
PUT /api/v1/admin/tracking-partners/schoolapplication/tenants HTTP/1.1
Host: fleetel-switchride-pmxt5.ondigitalocean.app
Authorization: Bearer TOKEN
Content-Type: application/json
Accept: application/json

{"tenantIds":["6ac4b568cb1a4bc2181cf1a8"]}
```

Read back:

```bash
curl -s https://fleetel-switchride-pmxt5.ondigitalocean.app/api/v1/admin/tracking-partners/schoolapplication/tenants \
  -H "Authorization: Bearer $TOKEN"
```

### 6.4 Map devices and vehicles (stores `tracking_partner_assets`)

**curl**

```bash
curl -s -X PUT https://fleetel-switchride-pmxt5.ondigitalocean.app/api/v1/admin/tracking-partners/schoolapplication/assets \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"items":[{"tenantId":"6ac4b568cb1a4bc2181cf1a8","deviceId":"352312095160753","vehicleId":"6ac4b567cb1a4bc2181cefdb"},{"tenantId":"6ac4b568cb1a4bc2181cf1a8","deviceId":"SIM-TRACK-DEMO","vehicleId":"6abb799e25bda6ff2d0c3ac7"}]}'
```

**HTTP**

```http
PUT /api/v1/admin/tracking-partners/schoolapplication/assets HTTP/1.1
Host: fleetel-switchride-pmxt5.ondigitalocean.app
Authorization: Bearer TOKEN
Content-Type: application/json
Accept: application/json

{
  "items": [
    {
      "tenantId": "6ac4b568cb1a4bc2181cf1a8",
      "deviceId": "352312095160753",
      "vehicleId": "6ac4b567cb1a4bc2181cefdb"
    },
    {
      "tenantId": "6ac4b568cb1a4bc2181cf1a8",
      "deviceId": "SIM-TRACK-DEMO",
      "vehicleId": "6abb799e25bda6ff2d0c3ac7"
    }
  ]
}
```

`vehicleId` is optional; MoventraX fills it from the linked IoT device when present.

Read back: `GET /v1/admin/tracking-partners/schoolapplication/assets`.

If this list is empty, live queries use **all IoT devices in the mapped tenants**.

### 6.5 List applications

**curl**

```bash
curl -s https://fleetel-switchride-pmxt5.ondigitalocean.app/api/v1/admin/tracking-partners \
  -H "Authorization: Bearer $TOKEN"
```

**HTTP**

```http
GET /api/v1/admin/tracking-partners HTTP/1.1
Host: fleetel-switchride-pmxt5.ondigitalocean.app
Authorization: Bearer TOKEN
Accept: application/json
```

`PATCH /api/v1/admin/tracking-partners/schoolapplication` with `{"status":"Disabled"}` cuts off a partner without deleting mappings.

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
