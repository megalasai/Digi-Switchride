# GPS Telemetry Service

Canonical deploy repo (droplet): **https://github.com/megalasai/Telemetry**. This folder stays as the in-tree copy used by local `npm run dev:telemetry`.

Standalone GPS ingest process. Deploy this on a **droplet or VM with a public IP** — not on DigitalOcean App Platform (HTTP only). The Nest API stays on App Platform; this service writes to the **same MongoDB**.

**WanWay / GT06** TCP listens on `21100`, `5001`, and `8821`. Point trackers at this host. Register the IMEI in admin (vendor WanWay) and link a vehicle; positions show in the application.

**Configuration** (HTTP ingest, JSON/CSV TCP 4210, MQTT, pull APIs) is stored in **SQLite**. **Received GPS** is stored in **MongoDB** (`gps_positions`, `vehicles`, `iot_devices`).

It does not share the platform API process. Other apps call it over HTTP. It can also pull vendor APIs and accept TCP and MQTT.

When a coordinate is inside a configured hub geofence the stored name is the **hub name**. Otherwise it calls the location API (`LOCATION_API_URL`) and stores that **place name**.

## Requirements

- Node.js 22.13 or newer (built-in `node:sqlite`)
- MongoDB (`mongodb://localhost:27017/switchride`) for GPS
- Optional: location service on port 4100 for place names

## Run locally

From the repository root:

```bash
npm install
npm run dev:telemetry
```

Listens on `http://localhost:4200`.

## Droplet / VM

```bash
docker build -f apps/telemetry/Dockerfile -t fleetel-telemetry .
docker run -d --name telemetry --restart unless-stopped \
  -p 4200:4200 -p 4210:4210 -p 21100:21100 -p 5001:5001 -p 8821:8821 \
  -e MONGODB_URI="mongodb+srv://..." \
  -e LOCATION_API_URL="https://fleetel-switchride-pmxt5.ondigitalocean.app/geo" \
  -e PLATFORM_API_URL="https://fleetel-switchride-pmxt5.ondigitalocean.app" \
  -e WANWAY_TCP_PORTS="21100,5001,8821" \
  -v telemetry-data:/data \
  fleetel-telemetry
```

Open those TCP ports on the firewall. Health: `http://<droplet-ip>:4200/health`.

- SQLite config: `apps/telemetry/data/telemetry.sqlite`
- MongoDB GPS: `mongodb://localhost:27017/switchride` collections `gps_positions`, `vehicles`, `iot_devices`

```bash
curl -X POST http://localhost:4200/v1/gps ^
  -H "content-type: application/json" ^
  -H "X-Api-Key: dev-gps-ingest" ^
  -d "{\"deviceId\":\"SIM-TRACK-DEMO\",\"lat\":12.9784,\"lng\":77.6408}"
```

```bash
curl http://localhost:4200/v1/positions -H "X-Api-Key: dev-gps-ingest"
```

Contract: [contracts/openapi/telemetry-v1.yaml](../../contracts/openapi/telemetry-v1.yaml).

## How it sits next to Location API

| | Location API | Telemetry API |
|--|----------------|---------------|
| Path | `apps/location` | `apps/telemetry` |
| Package | `@digi-switchride/location` | `@digi-switchride/telemetry` |
| Local URL | `http://localhost:4100` | `http://localhost:4200` |
| Database | own SQLite (places) | SQLite config + MongoDB GPS (`switchride`) |
| Start | `npm run dev:location` | `npm run dev:telemetry` |

Telemetry **calls** the location API over HTTP. GPS is written to MongoDB, so the admin dashboard sees the same vehicles collection as the platform API.

## Channels (SQLite `sources`)

| kind | Direction |
|------|-----------|
| `pull` | This app GETs/POSTs a vendor URL on an interval |
| `http_push` | Devices POST here |
| `tcp` | Devices open a TCP socket |
| `mqtt` | This app subscribes to a broker |

First start seeds `local-http-push`, `local-tcp`, `local-mqtt` (off), `example-vendor-pull` (off), and **Track360 pull** (`track360-pull`, enabled). That source calls `https://prod-s1.track360.net.in/api/v1/auth/pull_api` and writes every IMEI into Mongo `iot_devices`.

The platform API also syncs Track360 on boot and every 30 seconds. Admin **IoT Devices** lists the full fleet; **Sync Track360** pulls immediately.

```bash
curl -X PUT http://localhost:4200/v1/sources/example-vendor-pull -H "Content-Type: application/json" -H "X-Api-Key: dev-gps-ingest" -d "{\"enabled\":true,\"url\":\"http://localhost:9090/gps/latest\"}"
```

`POST /v1/sources/{id}/pull` fetches immediately.

## API

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/v1/gps` | Push one GPS ping |
| GET | `/v1/positions` | Latest points + ~90s trail |
| GET/POST | `/v1/sources` | List / add pull, TCP, MQTT, HTTP feeds |
| GET/PUT | `/v1/settings` | Location API URL, ports, platform forward |
| GET/POST | `/v1/hubs` | Hub geofences used for hub vs place names |
| GET | `/health` | Process is up |

Management calls send `X-Api-Key: dev-gps-ingest` (change in SQLite settings after first run).
