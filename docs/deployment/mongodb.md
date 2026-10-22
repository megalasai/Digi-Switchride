# MongoDB for Digi-Switchride

Database name: **`switchride`**  
Default URI: `mongodb://127.0.0.1:27017/switchride`

Almost every operational collection has `tenantId` (string). **Fleetel** (`slug: fleetel`, `kind: Parent`) is the platform company. Customer companies are `kind: Tenant`. SuperAdmin users are not scoped to a tenant.

Location finder SQLite (`india.sqlite`) and telemetry config SQLite are **not** in MongoDB.

---

## Install MongoDB (Windows / POC)

### Option A — Docker (matches this repo)

```bash
docker compose up -d mongo
```

That starts MongoDB 7 on port **27017**, database `switchride`, volume `mongo_data`.

### Option B — Native Windows install

1. Install [MongoDB Community 7](https://www.mongodb.com/try/download/community) as a Windows service.
2. Keep default port `27017`.
3. Create the database on first connect (the API creates collections).

```text
mongosh
use switchride
db.adminCommand({ ping: 1 })
```

Set `apps/api/.env`:

```text
MONGODB_URI=mongodb://127.0.0.1:27017/switchride
```

Same URI in `apps/telemetry/.env`.

---

## Restore this project’s data

From the repository root, after Mongo is listening:

```bash
node scripts/mongo-restore.mjs backups/mongodb/switchride-latest
```

Or copy `backups/mongodb/switchride-latest` from another machine first.

Fresh empty install (no backup): start the API once. It bootstraps:

- Parent company **Fleetel**
- Sample tenant **Digi-Switchride**
- SuperAdmin `ADMIN_EMAIL` / `ADMIN_PASSWORD`

---

## Backup

```bash
node scripts/mongo-backup.mjs backups/mongodb/switchride-latest
```

Writes one JSON file per collection plus `manifest.json`.

BSON dump (if Database Tools are installed):

```bash
mongodump --uri="mongodb://127.0.0.1:27017/switchride" --out=backups/mongodb/bson
mongorestore --uri="mongodb://127.0.0.1:27017/switchride" --drop backups/mongodb/bson/switchride
```

---

## Collections (schema)

`createdAt` / `updatedAt` are added by Mongoose timestamps unless noted.

| Collection | Purpose | Main fields |
|------------|---------|-------------|
| `tenants` | Parent Fleetel + tenant companies | `slug`, `name`, `contactEmail`, `status` Active\|Suspended, `isDefault`, `kind` Parent\|Tenant, `notes` |
| `admin_users` | Portal users | `email`, `passwordHash`, `fullName`, `role`, `isActive`, `hubIds[]`, `tenantId` |
| `customers` | Riders | `username`, `passwordHash`, `phone`, `email`, `fullName`, `kycStatus`, `accountStatus`, `assignedVehicleId`, `rentalPlanId`, `walletBalance`, `referralCode`, `tenantId` |
| `kyc_submissions` | KYC docs | `customerId`, `documentType`, `fileUrl`, `status`, `reason`, `tenantId` |
| `otp_records` | Login OTP | `phone`, `codeHash`, `expiresAt`, `consumed` |
| `refresh_tokens` | Rider refresh | `customerId`, `tokenHash`, `expiresAt`, `revoked` |
| `rental_hubs` | Hubs | `name`, `address`, `location` GeoJSON Point `[lng,lat]`, `capacity`, `operatingHours`, `geoFenceRadiusM`, `status`, `tenantId` |
| `vehicles` | Fleet | `registrationNumber`, `type`, `wheelClass`, `model`, `hubId`, `status`, `batteryPercent`, `odometerKm`, `iotDeviceId`, `lastLat/Lng`, `lastPlace`, `locationTrail[]`, `assignedRiderId`, `tenantId` |
| `vehicle_events` | Fleet audit | `vehicleId`, `type`, `summary`, `actorEmail`, `metadata`, `tenantId` |
| `iot_devices` | Trackers | `deviceId` unique, `vehicleId`, `vendorType`, `connectionStatus`, `lastSeenAt`, `lastLat/Lng`, `tenantId` |
| `gps_positions` | Latest GPS (telemetry) | `deviceKey` unique, `deviceId`, `vehicleId`, `lat`, `lng`, `batteryPercent`, `odometerKm`, `lastPlace`, `locationTrail[]` |
| `rental_plans` | Price books | `name`, `charges`, `durationDays`, `billingFrequency`, `tenantId` |
| `wallet_transactions` | Wallet ledger | `riderId`, `type` Credit\|Debit, `amount`, `note`, `balanceAfter`, `tenantId` |
| `bookings` | Reservations | `customerId`, `vehicleId`, `hubId`, `type`, `status`, `amount`, `currency`, `tenantId` |
| `rides` | Active / past rides | `bookingId`, `customerId`, `vehicleId`, `status`, start/end, `tenantId` |
| `payments` | Money | `customerId`, `bookingId`, `amount`, `status`, `method`, `gatewayProvider`, `gatewayOrderId`, `gatewayPaymentId`, `razorpayOrderId`, `gstAmount`, `tenantId` |
| `payment_gateways` | Per-tenant PSP | `tenantId` unique, `provider`, `mode` Test\|Live, `enabled`, `keyId`, `keySecret`, `webhookSecret`, `methods[]`, `merchantId`, `checkoutUrl` |
| `promotions` | Coupons | `code`, `discountType`, `discountValue`, `validFrom/To`, `tenantId` |
| `support_tickets` | Helpdesk | `customerId`, `category`, `subject`, `status`, `notes[]`, `tenantId` |
| `charging_stations` | Chargers | `name`, `address`, `chargerCount`, `hubId`, `status`, `tenantId` |
| `notifications` | In-app notices | `title`, `body`, `audience`, `tenantId` |
| `feedback` | Ratings | `customerId`, `rating`, `comment`, `tenantId` |
| `agreements` | Contracts | `customerId`, `type`, `content`, `status`, `tenantId` |
| `breakdowns` | Incidents | `vehicleId`, `customerId`, `issueType`, `status`, `notes[]`, `tenantId` |
| `service_centres` | Workshops | `name`, `address`, `tenantId` |
| `service_slots` | Capacity slots | `centreId`, `date`, `startTime`, `endTime`, `capacity` |
| `service_requests` | Jobs | `customerId`, `vehicleId`, `category`, `status`, `tenantId` |
| `service_appointments` | Booked slots | `customerId`, `centreId`, `slotId`, `status`, `tenantId` |
| `branding` | Tenant logos | `key`, `productName`, `optionalLogo` Buffer, `tenantId` |
| `audit_logs` | Admin audit | `actorId`, `actorEmail`, `action`, `entityType`, `entityId`, `before`, `after` |

### Indexes the app expects

- `tenants.slug` unique  
- `admin_users` unique `{ tenantId, email }`  
- `vehicles` unique `{ tenantId, registrationNumber }`; sparse unique `iotDeviceId`  
- `iot_devices.deviceId` unique  
- `gps_positions.deviceKey` unique  
- `rental_hubs.location` 2dsphere  
- `payment_gateways.tenantId` unique  
- `promotions.code` unique  

Do not recreate a unique index on `iot_devices.vehicleId`.

---

## DigitalOcean / new server

1. Install Mongo 7 or use **Managed MongoDB**.
2. Create user + database `switchride`.
3. Copy `backups/mongodb/switchride-latest` and run `mongo-restore.mjs` with `MONGODB_URI` set to the new cluster.
4. Point API and telemetry at that URI (`tls=true` on managed clusters).
