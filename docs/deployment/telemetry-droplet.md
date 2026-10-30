# Telemetry droplet (WanWay / GPS TCP)

App Platform cannot publish TCP ports. Run **`apps/telemetry`** on a DigitalOcean droplet with a public IPv4. It writes GPS into the **same Managed MongoDB** as the API (`switchride`).

The Mongo password is **not** in GitHub. Set `MONGODB_URI` only in `/opt/telemetry/.env` on the droplet.

## Minimum droplet

| Setting | Minimum | Why |
|---------|---------|-----|
| Plan | **Basic, 2 GB RAM / 1 vCPU** (`s-1vcpu-2gb`) | Node 22 + mongoose + GT06 listeners. 1 GB often OOMs. |
| Region | **Bangalore (BLR1)** | Same region as `db-mdb-blr1-25924`. |
| Image | **Ubuntu 24.04 LTS** | Node 22 packages and Docker. |
| Disk | Default (~50 GB) | SQLite config is small; GPS lives in Mongo. |
| Networking | Public IPv4 | Trackers must reach this host. |
| Backups | Optional weekly snapshot | Config SQLite only; GPS is in Managed Mongo. |

Do not put Mongo on this droplet. Use the existing cluster.

## Mongo trusted sources

In **Databases → db-mdb-blr1-25924 → Trusted sources**, add:

1. The App Platform app (API)
2. This droplet (by droplet name or its public IP)

Do not open the cluster to `0.0.0.0/0`.

Connection string (password only in droplet env):

```text
mongodb+srv://switchride_app:PASSWORD@db-mdb-blr1-25924-b48d6f39.mongo.ondigitalocean.com/switchride?tls=true&authSource=admin&replicaSet=db-mdb-blr1-25924
```

## Firewall (Cloud Firewall on the droplet)

| Port | Protocol | Source | Use |
|------|----------|--------|-----|
| 22 | TCP | Your office / home IP | SSH |
| 4200 | TCP | Optional (admin health) | HTTP health / ingest |
| 4210 | TCP | Devices / internet | JSON GPS TCP |
| 21100 | TCP | Devices / internet | WanWay / GT06 |
| 5001 | TCP | Devices / internet | WanWay |
| 8821 | TCP | Devices / internet | WanWay |

## Deploy

SSH as root (or a sudo user).

```bash
apt-get update
apt-get install -y ca-certificates curl git
curl -fsSL https://get.docker.com | sh
usermod -aG docker "$USER"

mkdir -p /opt/telemetry
cat >/opt/telemetry/.env <<'EOF'
TELEMETRY_HTTP_HOST=0.0.0.0
TELEMETRY_HTTP_PORT=4200
TELEMETRY_TCP_HOST=0.0.0.0
TELEMETRY_TCP_PORT=4210
WANWAY_TCP_ENABLED=true
WANWAY_TCP_HOST=0.0.0.0
WANWAY_TCP_PORTS=21100,5001,8821
TELEMETRY_SQLITE=/data/telemetry.sqlite
LOCATION_API_URL=https://fleetel-switchride-pmxt5.ondigitalocean.app/geo
PLATFORM_API_URL=https://fleetel-switchride-pmxt5.ondigitalocean.app
MONGODB_URI=mongodb+srv://switchride_app:PASSWORD@db-mdb-blr1-25924-b48d6f39.mongo.ondigitalocean.com/switchride?tls=true&authSource=admin&replicaSet=db-mdb-blr1-25924
EOF
chmod 600 /opt/telemetry/.env
```

Replace `PASSWORD` with the `switchride_app` password.

Clone and run (from this GitHub repo, same branch as App Platform):

```bash
cd /opt
git clone -b cursor/nestjs-mongodb-platform-scaffold https://github.com/megalasai/Digi-Switchride.git
cd Digi-Switchride
docker build -f apps/telemetry/Dockerfile -t fleetel-telemetry .
docker rm -f telemetry 2>/dev/null || true
docker run -d --name telemetry --restart unless-stopped \
  --env-file /opt/telemetry/.env \
  -p 4200:4200 -p 4210:4210 -p 21100:21100 -p 5001:5001 -p 8821:8821 \
  -v telemetry-data:/data \
  fleetel-telemetry
```

Check:

```bash
docker logs -f telemetry
curl -s http://127.0.0.1:4200/health
```

Logs mask the Mongo user/password. You should see `MongoDB GPS mongodb+srv://***@db-mdb-blr1-25924-…`.

Point WanWay devices at **this droplet’s public IP**, ports `21100`, `5001`, or `8821`. Register the IMEI in admin **IoT Devices** as vendor WanWay.

## Update later

```bash
cd /opt/Digi-Switchride
git pull
docker build -f apps/telemetry/Dockerfile -t fleetel-telemetry .
docker rm -f telemetry
docker run -d --name telemetry --restart unless-stopped \
  --env-file /opt/telemetry/.env \
  -p 4200:4200 -p 4210:4210 -p 21100:21100 -p 5001:5001 -p 8821:8821 \
  -v telemetry-data:/data \
  fleetel-telemetry
```

If you still use the standalone **https://github.com/megalasai/Telemetry** clone on the droplet, set the same `MONGODB_URI` in that process’s env and restart. Prefer this repo so Dockerfile and ingest stay in sync with the API.