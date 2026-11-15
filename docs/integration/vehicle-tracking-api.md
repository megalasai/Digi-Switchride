# MoventraX vehicle tracking API

Use this guide to connect an external product (for example a school or operations app) to live and historical GPS from MoventraX.

**Base URL (production):** `https://fleetel-switchride-pmxt5.ondigitalocean.app/api`  
**Base URL (local):** `http://localhost:4000/api`

All partner calls send JSON over HTTPS. Dates are ISO-8601 UTC (`2026-11-15T08:00:00.000Z`).

**Postman:** import [`MoventraX-Vehicle-Tracking.postman_collection.json`](./MoventraX-Vehicle-Tracking.postman_collection.json). Paste the shared tracking token into collection variable `apiKey`. Every request (register, mapping, live, history) sends it. Default `baseUrl` is production HTTPS. For local, set `baseUrl` to `http://localhost:4000/api`.

MoventraX does **not** create your application for you. Your product sends `applicationId` and `tenantId` (and later device/vehicle rows). MoventraX stores those mappings and then serves live/history GPS.

### Sample fleet in this environment

| Field | Value |
|-------|--------|
| `applicationId` | `schoolapplication` (you create this once via POST) |
| `tenantId` | `6ac4b568cb1a4bc2181cf1a8` (`digi-switchride`) |
| `deviceId` | `352312095160753` (KA01AQ6087) |
| `vehicleId` | `6ac4b567cb1a4bc2181cefdb` |
| Demo device | `SIM-TRACK-DEMO` / vehicle `6abb799e25bda6ff2d0c3ac7` (KA01SR9999) |

## 1. Who creates what

The **external application** owns one-time setup. MoventraX only stores what you send.

| Step | Who calls | What is stored |
|------|-----------|----------------|
| 1. Register `applicationId` | External app `POST /v1/tracking/applications` with the shared token | `tracking_partner_apps` |
| 2. Map tenants | External app `PUT` or `POST .../tenants` | `tracking_partner_tenants` |
| 3. Map devices / vehicles | External app `PUT` or `POST .../assets` | `tracking_partner_assets` |
| 4. Live / history | External app `GET` | Read IoT + GPS |

You choose the slug (`schoolapplication`). You send MoventraX `tenantId` values (or tenant slugs such as `digi-switchride`). After that, live APIs only return devices linked to those mappings.

## 2. Authentication

MoventraX issues **one tracking API token** privately (not created by your app). Use that same token on **every** call, including register and mapping.

```http
X-Api-Key: mtx_the_token_you_were_given
```

or

```http
Authorization: Bearer mtx_the_token_you_were_given
```

A `401` means the token is missing, wrong, or disabled. A `409` on register means that `applicationId` already exists — `PUT` tenants and devices instead.

## 3. Partner APIs

Replace `{applicationId}` with your slug.

### 3.0 Register application (one-time)

Requires the shared tracking token.

```http
POST /v1/tracking/applications
X-Api-Key: mtx_the_token_you_were_given
```

Body can include `tenantIds` so application + tenant mapping is created in one call.

### 3.1 Tenant mapping (create or replace)

The external application sends the tenant list. `PUT` and `POST` both replace the stored mapping.

```http
PUT /v1/tracking/{applicationId}/tenants
POST /v1/tracking/{applicationId}/tenants
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

### 3.2 Device, vehicle, tenant, and application mapping (create or replace)

The external application sends device/vehicle rows. `PUT` and `POST` both replace the stored mapping.

```http
PUT /v1/tracking/{applicationId}/assets
POST /v1/tracking/{applicationId}/assets
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

```bash
BASE=https://fleetel-switchride-pmxt5.ondigitalocean.app/api
APP=schoolapplication
KEY=mtx_the_token_moventrax_shared_privately
TENANT=6ac4b568cb1a4bc2181cf1a8
DEVICE=352312095160753
VEHICLE=6ac4b567cb1a4bc2181cefdb
```

### 4.0 Register application (external app, one-time)

**curl**

```bash
curl -s -X POST "$BASE/v1/tracking/applications" \
  -H "X-Api-Key: $KEY" -H "Content-Type: application/json" \
  -d '{"applicationId":"schoolapplication","name":"School tracking","tenantIds":["6ac4b568cb1a4bc2181cf1a8"]}'
```

**HTTP**

```http
POST /api/v1/tracking/applications HTTP/1.1
Host: fleetel-switchride-pmxt5.ondigitalocean.app
X-Api-Key: mtx_the_token_you_were_given
Content-Type: application/json
Accept: application/json

{"applicationId":"schoolapplication","name":"School tracking","tenantIds":["6ac4b568cb1a4bc2181cf1a8"]}
```

You can send `tenantIds` as Mongo ids or slugs (`digi-switchride`).

### 4.1 Tenant mapping (PUT from the external app)

**curl**

```bash
curl -s -X PUT "$BASE/v1/tracking/$APP/tenants" \
  -H "X-Api-Key: $KEY" -H "Content-Type: application/json" \
  -d '{"tenantIds":["6ac4b568cb1a4bc2181cf1a8"]}'

curl -s -H "X-Api-Key: $KEY" "$BASE/v1/tracking/$APP/tenants"
```

**HTTP**

```http
PUT /api/v1/tracking/schoolapplication/tenants HTTP/1.1
Host: fleetel-switchride-pmxt5.ondigitalocean.app
X-Api-Key: mtx_paste_your_key
Content-Type: application/json
Accept: application/json

{"tenantIds":["6ac4b568cb1a4bc2181cf1a8"]}
```

`POST` to the same path is accepted and does the same replace.

### 4.2 Device / vehicle / tenant / application mapping (PUT from the external app)

**curl**

```bash
curl -s -X PUT "$BASE/v1/tracking/$APP/assets" \
  -H "X-Api-Key: $KEY" -H "Content-Type: application/json" \
  -d '{"items":[{"tenantId":"6ac4b568cb1a4bc2181cf1a8","deviceId":"352312095160753","vehicleId":"6ac4b567cb1a4bc2181cefdb"},{"tenantId":"6ac4b568cb1a4bc2181cf1a8","deviceId":"SIM-TRACK-DEMO","vehicleId":"6abb799e25bda6ff2d0c3ac7"}]}'

curl -s -H "X-Api-Key: $KEY" "$BASE/v1/tracking/$APP/assets"
```

**HTTP**

```http
PUT /api/v1/tracking/schoolapplication/assets HTTP/1.1
Host: fleetel-switchride-pmxt5.ondigitalocean.app
X-Api-Key: mtx_paste_your_key
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
2. `baseUrl` is production HTTPS.  
3. Paste the shared token into `apiKey`, then run **Register application**.  
4. Run **Put tenant mapping** and **Put device mapping**.  
5. Run live and history requests.

## 5. HTTP status codes

| Code | Meaning |
|------|---------|
| 200 | Success |
| 400 | Missing/invalid query (for example no `deviceId`, bad dates) |
| 401 | Missing or invalid API key |
| 404 | Application, device, or vehicle not mapped |
| 409 | Duplicate `applicationId` (create only) |

## 6. Optional MoventraX admin (support only)

External applications must register themselves with `POST /v1/tracking/applications`. Admin JWT routes below are only for MoventraX operators to list, disable, or recover a key. They are not required for integration.

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
| `tracking_access_tokens` | hashed shared API tokens used on every tracking call |
| `tracking_partner_apps` | applicationId, name, status |
| `tracking_partner_tenants` | applicationId ↔ tenantId |
| `tracking_partner_assets` | applicationId ↔ tenantId ↔ deviceId ↔ vehicleId |
| `iot_devices` | Latest telemetry |
| `vehicles` | Registration, status, last place |
| `gps_track_points` | History breadcrumbs (TTL 180 days) |

## 8. Integration checklist

1. Store the shared tracking token MoventraX sent you.  
2. `POST /v1/tracking/applications` with that token, your `applicationId`, and `tenantIds`.  
3. `PUT /v1/tracking/{applicationId}/tenants` if you need to change companies later.  
4. `PUT /v1/tracking/{applicationId}/assets` with device/vehicle rows.  
5. Poll `GET .../live` for the fleet map.  
6. Poll `GET .../live/vehicle` when a user opens one vehicle.  
7. Call `GET .../history` for playback (max 31 days per request).

Do not embed the API key in a public mobile app. Keep it on your backend and proxy map requests from your application.
