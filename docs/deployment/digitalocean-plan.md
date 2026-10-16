# DigitalOcean deployment plan — Digi-Switchride

**POC (this cut):** one 4 GB droplet, Mongo in Docker, images in `apps/*/Dockerfile`, compose in `infra/digitalocean/`. Follow `infra/digitalocean/README.md`. Scale to two droplets + Managed MongoDB later (Phase B below).


Fleetel deploys three server-side products plus the admin web portal:

| Product | App | Runtime | Port | Data |
|---------|-----|---------|------|------|
| Switchride web | NestJS API | Node 20+ | 4000 (`/api`) | MongoDB |
| Switchride web | Next.js admin | Node 20+ | 3000 | none (proxies API) |
| Location finder | Fastify | Node 22+ | 4100 | SQLite (`india.sqlite`) |
| Telemetry | Fastify | Node 22+ | 4200 HTTP, 4210 TCP | SQLite config + MongoDB GPS |

Android / iOS are out of this cloud cut. Redis in `docker-compose.yml` is unused by the apps and is **not** required.

---

## Recommended topology (pilot → production)

Do **not** put location or telemetry on DigitalOcean App Platform first. Location needs a large persistent SQLite file (GeoNames + optional ~1.7 GB OSM import). Telemetry needs a public **TCP** ingest port that App Platform does not expose cleanly.

**Target shape**

```
                    Internet
                       |
              DO Load Balancer / nginx
              TLS on 443 (and 4210 TCP)
                       |
        +--------------+---------------+
        | VPC (blr1 or lon1)           |
        |                              |
        |  droplet-app     droplet-data|
        |  nginx           location    |
        |  admin-web :3000 telemetry   |
        |  api :4000       SQLite disks|
        |         \          /         |
        |          Managed MongoDB     |
        +------------------------------+
```

Public hostnames (example):

- `admin.switchride.example.com` → admin web
- `api.switchride.example.com` → Nest API
- `location.switchride.example.com` → location finder (API keys, not public anonymous)
- `telemetry.switchride.example.com` → GPS HTTP ingest
- TCP `telemetry.switchride.example.com:4210` → device sockets

All Mongo traffic stays on the VPC private network.

---

## Resource plan

### Phase A — pilot (internal / first customer, ~30–100 vehicles)

Enough for current Track360-scale load (10 s GPS refresh, reverse-geocode on ingest).

| Resource | Spec | Why | Approx. monthly* |
|----------|------|-----|------------------|
| VPC | Bangalore (`blr1`) or closest to Fleetel / Track360 | Private Mongo, no public DB | $0 |
| Managed MongoDB | Replica set, **2 vCPU / 4 GB**, 40–80 GB storage, daily backups | Shared by API + telemetry GPS | $60–120 |
| Droplet `switchride-app` | **Regular 2 vCPU / 4 GB**, 80 GB SSD, backups | nginx + API + Next.js | $24 + $5 backup |
| Droplet `switchride-data` | **Regular 2 vCPU / 4 GB**, 80 GB SSD | location + telemetry processes | $24 + $5 backup |
| Block volume | **80–100 GB** on `switchride-data` | `india.sqlite`, OSM cache, `telemetry.sqlite` | $8–10 |
| Reserved IPs | 2 | Stable DNS / firewall for devices | $0 if attached |
| Spaces | 250 GB, optional CDN | SQLite snapshots, logs | ~$5 |
| Firewall | 2 (app + data) | Deny 27017 / 4000 / 4100 from public if proxied | $0 |
| TLS | Let’s Encrypt via Caddy or certbot | HTTPS | $0 |
| **Pilot total** | | | **~$130–180 / month** |

\*DigitalOcean list prices change; treat as planning bands, not a quote.

### Phase B — production (multi-tenant, hundreds of vehicles)

| Resource | Spec | Why |
|----------|------|-----|
| Managed MongoDB | 4 GB+ RAM, 3-node replica, PITR | HA for bookings + GPS |
| `switchride-app` | 4 vCPU / 8 GB | Next.js + Nest under concurrent admins |
| `switchride-location` | 4 vCPU / 8 GB, `LOCATION_WORKERS=auto` | 100k lookups / 10 minutes design point |
| `switchride-telemetry` | 2–4 vCPU / 4–8 GB | Isolated ingest; TCP storm does not take down admin |
| Block volumes | 150–250 GB location | OSM import + growth |
| Load Balancer | HTTP(S) + TCP 4210 | HA when a second app droplet is added |
| Monitoring | DO Monitoring + uptime checks | `/health` on each app |
| Snapshots | Weekly droplets + Spaces dump of SQLite | Disaster recovery |

**Production band: ~$280–450 / month** before support and extra droplets.

### What not to buy yet

- Kubernetes (DOKS) — extra ops until you need rolling deploys of many replicas.
- Managed Redis — unused.
- App Platform for location/telemetry — volume + TCP mismatch.
- Public MongoDB — GPS and rider data must stay VPC-only.

---

## How the apps talk after deploy

```
Admin browser → https://admin → Next.js
                              → /api-proxy/* → http://127.0.0.1:4000/api  (same droplet)

API          → Managed MongoDB
API          → http://location:4100  (reverse geocode / hub maps)
API          → Track360 pull_api (outbound HTTPS)

Telemetry    → MongoDB (gps_positions, iot_devices, vehicles)
Telemetry    → http://location:4100  (place name if outside hub)
Telemetry    → http://api:4000/api/v1/internal/iot/telemetry  (optional forward)

Location     → local SQLite only
```

Environment mapping (production values, not the local `.env.example`):

| Variable | Set on | Notes |
|----------|--------|-------|
| `MONGODB_URI` | API, telemetry | Private DO Mongo URI + `tls=true` |
| `JWT_SECRET` / `PASSWORD_SALT` | API | 32+ random chars; never reuse dev |
| `CORS_ORIGIN` | API | `https://admin.…` |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` | API | Bootstrap only; change after first login |
| `LOCATION_API_URL` | API, telemetry | `http://10.x.x.x:4100` (VPC) |
| `LOCATION_API_KEY` | API, telemetry, location | Named keys, e.g. `switchride:…,telemetry:…` |
| `TRACK360_PULL_URL` / user / password | API (and telemetry SQLite source) | Store as secrets |
| `API_PROXY_TARGET` | admin-web | `http://127.0.0.1:4000` |
| `NEXT_PUBLIC_API_URL` | admin-web | `/api-proxy/v1` (keep relative) |
| `TELEMETRY_HTTP_API_KEY` | telemetry | Device ingest key |
| `TELEMETRY_SQLITE` / `LOCATION_DB` | data droplet | Paths on the block volume |
| `PLATFORM_API_URL` | telemetry | Internal API URL |

---

## Approach in phases

### 0. Decide region and DNS (1 day)

1. Pick a DigitalOcean region close to India operators (`blr1` preferred).
2. Confirm a domain Fleetel controls.
3. Create a project `digi-switchride-prod` (or `-pilot`).
4. List secrets: JWT, admin bootstrap, Track360, Razorpay, location API keys. These go in DO App/Droplet env or a small secrets file with `chmod 600`, not git.

### 1. Containerise what is missing (2–3 days)

Location already has `apps/location/Dockerfile`. Add the same pattern for:

- `apps/api/Dockerfile` — `npm ci`, build `shared` + `api`, `node dist/main.js`
- `apps/admin-web/Dockerfile` — `next build` + `next start`
- `apps/telemetry/Dockerfile` — `node dist/…`, volume `/data` for SQLite
- Root `docker-compose.prod.yml` used **on droplets** (not as a public compose cloud):
  - `app` droplet: `api`, `admin-web`, `nginx`/`caddy`
  - `data` droplet: `location`, `telemetry`

Do not start Mongo in compose on the droplet; use **Managed MongoDB**.

### 2. Provision cloud resources (half day)

1. Create VPC.
2. Create Managed MongoDB in that VPC; allow only droplet private IPs.
3. Create two Droplets (Ubuntu 24.04, SSH keys only, monitoring on).
4. Attach 80–100 GB volume to `switchride-data`; mount at `/var/lib/switchride`.
5. Create Cloud Firewalls:
   - **App:** 22 (your IP), 80, 443
   - **Data:** 22 (your IP), 80/443 if TLS terminates here, **4210/tcp** if devices ingest over the internet, **4100/4200 only from app droplet** if nginx fronts them
   - Mongo: no public 27017
6. Assign reserved IPs; create DNS A records.

### 3. OS baseline on both droplets (half day)

1. `unattended-upgrades`, UFW matching the cloud firewall, fail2ban.
2. Docker Engine + Compose plugin.
3. Caddy or nginx for TLS.
4. Log rotation; 20% disk watermark.

### 4. Seed location finder once (half day + download time)

On `switchride-data`, with the volume mounted:

```bash
# after image is built
LOCATION_DB=/var/lib/switchride/location/india.sqlite npm run seed:location
# optional richness (1.7 GB download, extra disk + RAM)
npm run import:osm
```

Expect first seed to take a long time. Snapshot the volume **after** a successful `/ready`. Start location with `LOCATION_WORKERS=1` on 4 GB RAM; raise to `auto` when you move to 8 GB.

### 5. Deploy telemetry (same droplet, same day)

1. Start with HTTP ingest + Track360 pull (already the default source).
2. Point `MONGODB_URI` at managed Mongo (same DB name `switchride` as the API).
3. Point `LOCATION_API_URL` at `http://127.0.0.1:4100` (same host).
4. Persist `TELEMETRY_SQLITE` on the volume so sources/settings survive rebuilds.
5. Open **4210/tcp** only if physical devices will socket in; otherwise keep it VPC/localhost.
6. Rotate `TELEMETRY_HTTP_API_KEY` away from `dev-gps-ingest`.

### 6. Deploy Switchride web (app droplet)

1. Start API against Managed Mongo; confirm bootstrap admin, then change the password.
2. Start admin-web with `API_PROXY_TARGET=http://127.0.0.1:4000`.
3. Caddy/nginx:
   - `admin.` → `:3000`
   - `api.` → `:4000`
4. Set `CORS_ORIGIN` to the admin HTTPS origin.
5. Set `LOCATION_API_URL` to the **private** data-droplet IP, not the public hostname.
6. Smoke: login, dashboard map, IoT list, branding upload.

### 7. Wire and harden (1 day)

- API keys on location (`LOCATION_API_KEYS`).
- SuperAdmin vs company logins still work over HTTPS.
- Outbound allow: Track360, OSM/GeoNames only during seed, Let’s Encrypt.
- Backups: Mongo PITR + nightly `mongodump` to Spaces; volume snapshot of SQLite.
- Uptime checks: `/health` (API, location, telemetry) and admin `/login`.
- Log shipping (optional): DO Monitoring or a single Loki/grafana later.

### 8. Cutover checklist

- [ ] DNS TTL lowered beforehand
- [ ] TLS valid
- [ ] Mongo reachable only on VPC
- [ ] Location `/ready` reports populated tables
- [ ] Telemetry writing `gps_positions` and Track360 devices
- [ ] Admin dashboard shows vehicles without resetting zoom
- [ ] Android later: point it at `https://api.…` + tenant slug (not part of this cut)
- [ ] Dev secrets (`Admin@123`, `dev-secret-key…`) not used in production
- [ ] Snapshot both droplets after first green day

### 9. Operate

| Cadence | Action |
|---------|--------|
| Daily | Uptime + disk on location volume |
| Weekly | Droplet snapshots |
| After release | Build images in CI, `docker compose pull && up -d` on each droplet |
| Monthly | Mongo storage growth vs GPS retention |
| When GPS QPS grows | Split telemetry onto its own droplet; add LB |

---

## CI suggestion (after first manual deploy)

GitHub Actions (or DO Container Registry):

1. On tag: build four images, push to `registry.digitalocean.com/fleetel/…`
2. SSH (or doctl) to droplets, pull, recreate containers
3. Do **not** re-run `seed:location` on every deploy

---

## Team split

| Role | Work |
|------|------|
| Cloud | VPC, droplets, Mongo, firewall, DNS, backups |
| App | Dockerfiles, env, nginx, API CORS, admin proxy |
| Data | Location seed/OSM, telemetry sources, Track360 keys |
| QA | Login, map, IoT sync, reverse geocode, GPS ingest |

---

## First concrete next steps (this week)

1. Create the DigitalOcean project + VPC + SSH keys.
2. Add Dockerfiles for API, admin-web, and telemetry (location already exists).
3. Create Managed MongoDB and two droplets as in Phase A.
4. Seed location onto the block volume **once**, snapshot it.
5. Bring API + admin up behind TLS and run the smoke list in section 6.

Do not start with Kubernetes or App Platform for this stack. Two droplets, managed Mongo, and a disk for SQLite is the shortest path that matches how the apps actually run.
