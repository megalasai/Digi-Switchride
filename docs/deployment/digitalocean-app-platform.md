# DigitalOcean App Platform + databases

App Platform is DigitalOcean’s PaaS: connect GitHub, build from the Dockerfiles, get HTTPS and deploys. It is a good fit for **HTTP apps**. It is **not** a place to run MongoDB or the India SQLite file.

## What each product is for

| Need | DigitalOcean product | Use here |
|------|----------------------|----------|
| Admin web, API (HTTP) | **App Platform** web services | Yes |
| MongoDB (riders, fleet, GPS, tenants) | **Managed Databases → MongoDB** | Yes — attach to the app |
| Location finder (`india.sqlite`) | **App Platform** web service (HTTP 4100) or Droplet + volume | Yes — third Dockerfile service |
| Telemetry HTTP ingest | App Platform **or** droplet | HTTP yes; **TCP :4210** needs a droplet |
| Telemetry config SQLite | Droplet volume | Lost on App Platform redeploy |
| Redis / Postgres / MySQL | Managed Databases | **Not used** by Digi-Switchride |

Redis in `docker-compose.yml` is unused. Do not buy Redis, PostgreSQL, or MySQL for this stack.

---

## Why “Build failed” / Functions errors happen

Two separate autodetections:

**A. Functions (this log):** `Action 'shared/src' … runtime 'typescript:default' is not supported`

App Platform added a **Functions** component because it saw a top-level `packages/` folder. Auto-deploy keeps rebuilding that component on every GitHub push. Ignore files do not stop it.

**You must remove Functions in the control panel** (GitHub auto-deploy cannot delete it):

1. Open app **digi-switchride2**.
2. **Settings → App Spec** → replace the YAML with `.do/app.yaml` from this repo (no `functions:` block) → Save.  
   Or **Settings → Components** → open the Functions component → **Destroy Component**.
3. Shared TypeScript now lives in `libs/shared`. `packages/` only has a tiny `_noop/ping` so a leftover Functions component can finish building instead of crashing on TypeScript.

Keep only **Web Service** Dockerfiles: API, admin, location. No Functions.

**B. Node buildpack (app named like Digi-Switchride, not Functions):** `A build script exited with a non-zero exit code` after ~50s is almost always **Next.js OOM** on a small builder, or **devDependencies omitted** (`nest` / `tsc` not found). Root `npm run build` now compiles **shared + API only**. Admin is a separate Dockerfile service. `.npmrc` sets `production=false` so TypeScript/Nest are installed during build.

Create the app as **three Dockerfile web services** (one HTTP port each). DigitalOcean does not allow 3000 and 4000 on a single component.

1. Branch `cursor/nestjs-mongodb-platform-scaffold`.
2. API: Dockerfile `apps/api/Dockerfile`, HTTP **4000**, health `/api/health`.
3. Admin: Dockerfile `apps/admin-web/Dockerfile`, HTTP **3000**, health `/login`.
4. Location: Dockerfile `apps/location/Dockerfile`, HTTP **4100**, health `/health`.
5. Or import `.do/app.yaml` (Apps → Create → App Spec).
6. Destroy any Functions component.

In **Create App**, if DigitalOcean suggests a Functions resource from `packages/`, **uncheck / remove it** before Create.

## App Platform: what to put on it

Create one App with three **Web Services** (Dockerfile, repo `megalasai/Digi-Switchride`):

| Component | Dockerfile | HTTP port | Instances (POC) |
|-----------|------------|-----------|-----------------|
| `api` | `apps/api/Dockerfile` | 4000 | 1 × basic-xxs |
| `admin` | `apps/admin-web/Dockerfile` | 3000 | 1 × basic-xxs |
| `location` | `apps/location/Dockerfile` | 4100 | 1 × basic-xs (first boot seeds India SQLite) |

Env on **api**:

- `PORT=4000`
- `MONGODB_URI` — bind to the managed Mongo connection (see below)
- `JWT_SECRET`, `PASSWORD_SALT`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`
- `CORS_ORIGIN=https://admin-xxxx.ondigitalocean.app` (or your domain)
- `LOCATION_SERVICE_URL=http://location:4100` (internal App Platform name)

Env on **admin**:

- `PORT=3000`
- `API_PROXY_TARGET=http://api:4000` (internal component name) or the API public URL
- `NEXT_PUBLIC_API_URL=/api-proxy/v1`

App Platform only exposes **HTTP/HTTPS**. It will not publish telemetry TCP `4210`. Keep Track360 **pull** (outbound HTTPS) — that works from App Platform. Device **push over TCP** does not.

Location on App Platform: first deploy downloads/seeds `india.sqlite` (can take several minutes; health check delay is 180s). The file is ephemeral unless you later attach a volume. The SQLite dump is **not** in Git (hundreds of MB; GitHub file limit 100 MB). Source is `apps/location/`.

**Hybrid:**

```
GitHub  →  App Platform:  admin :3000  +  api :4000  +  location :4100
                 |
                 |  private VPC
                 v
          Managed MongoDB

Droplet (optional later): telemetry TCP :4210
```

---

## How to deploy MongoDB (the real database)

Do **not** run `mongo:7` as an App Platform component. There is no durable disk for a replica set, no backups, and a restart wipes GPS and riders.

### Option A — DigitalOcean Managed MongoDB (use this)

1. Cloud → **Databases** → Create → **MongoDB**.
2. Same region as the app (`blr1` if the fleet is in India).
3. POC size: smallest replica (about 1–2 GB RAM). Production: 4 GB+ and a 3-node replica.
4. Database name: `switchride` (matches local `MONGODB_URI`).
5. Create a user, e.g. `switchride_app`. Copy the password once.
6. **Trusted sources**: the App Platform app **and** the location/telemetry droplet. Do not leave Mongo open to `0.0.0.0/0`.
7. Use the **VPC / private** connection string inside DigitalOcean. Public hostname only if a laptop must connect (then restrict by IP).

Connection string shape:

```text
mongodb+srv://switchride_app:PASSWORD@switchride-mongo-xxxx.mongo.ondigitalocean.com/switchride?tls=true&authSource=admin&replicaSet=...
```

If SRV fails from Node (seen on some Windows/dev setups), use the **non-SRV** host list from the DO control panel. The API already supports `MONGODB_URI_DIRECT`.

8. In App Platform → api component → **Environment Variables** → `MONGODB_URI` as a **secret**, or **Attach Database** so DigitalOcean injects the URI.
9. Same `MONGODB_URI` on the telemetry droplet so GPS lands in the same `switchride` database (`gps_positions`, `iot_devices`, `vehicles`).

Backups: enable daily backups on the managed cluster (checkbox in Databases). That is the backup story for Mongo. Do not rely on droplet snapshots for rider/GPS data if Mongo is managed.

### Option B — MongoDB Atlas

Same idea: Atlas cluster, VPC peering or IP allowlist, `MONGODB_URI` into App Platform. Use this only if Fleetel already standardises on Atlas. Otherwise stay on DO Managed Mongo so networking stays in one cloud.

### Option C — Mongo in Docker on a droplet (POC only)

This is what `infra/digitalocean/docker-compose.poc.yml` already does (`mongo:7` + volume `mongo_data`). Fine for a demo. Not for App Platform. Move to Managed MongoDB before a customer POC with real vehicles.

---

## Other “databases” in this product

| Store | Engine | Where to put it | Do not |
|-------|--------|-----------------|--------|
| `switchride` | MongoDB 7 | Managed MongoDB | App Platform container |
| `india.sqlite` | SQLite | Droplet block volume `/var/lib/switchride/location` | App Platform (rebuilds on deploy) |
| `telemetry.sqlite` | SQLite | Same droplet volume (ingest sources, keys) | App Platform (config vanishes) |

SQLite is a **file**, not a DigitalOcean Database SKU. You cannot “create a SQLite cluster” in the control panel. You attach a **Volume** to a droplet and set:

```text
LOCATION_DB=/mnt/switchride/india.sqlite
TELEMETRY_SQLITE=/mnt/switchride/telemetry.sqlite
```

Seed location **once** (`entrypoint` downloads GeoNames if the file is missing), then snapshot the volume.

---

## App Platform steps (when you are ready)

1. Create **Managed MongoDB** in `blr1`, DB `switchride`, trusted sources empty until the app exists.
2. Create **App** from GitHub `megalasai/Digi-Switchride`, branch `cursor/nestjs-mongodb-platform-scaffold` (or `main` after merge).
3. Add Dockerfile services `api` and `admin` as above. Health check: `GET /api/health` on api, `GET /login` on admin.
4. Attach the Mongo cluster; set secrets.
5. Keep the **existing POC droplet** (or a small 2 GB droplet) for location + telemetry only; point `LOCATION_API_URL` at it; point telemetry `MONGODB_URI` at the same managed cluster.
6. Custom domains later: App Platform manages Let’s Encrypt for admin + api; droplet Caddy for location/telemetry if needed.

POC cost band if you mix App Platform + smallest Mongo + tiny data droplet: typically **higher** than the single 4 GB droplet compose (~$24), because Managed MongoDB alone is often **$15–60+/mo**. App Platform is for easier deploys, not for a cheaper POC.

---

## Quick decision

| Goal | Choice |
|------|--------|
| Cheapest working POC | One droplet + Mongo in Docker (current compose) |
| GitHub auto-deploy of web/API | App Platform for admin + api **plus** Managed MongoDB **plus** droplet for location/telemetry |
| Production data | Managed MongoDB only; never App Platform local disk |
| Location + GPS TCP | Droplet + volume, not App Platform |
