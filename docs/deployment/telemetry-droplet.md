# Telemetry droplet (WanWay / GPS TCP)

App Platform cannot publish TCP ports. Run the **standalone** repo **https://github.com/megalasai/Telemetry** on a DigitalOcean droplet. Do **not** `docker build -f apps/telemetry/Dockerfile` from Digi-Switchride — that install uses npm workspaces and will fail on a small droplet (`Exit handler never called` is usually the process being killed).

This process writes GPS into the **same Managed MongoDB** as the API (`switchride`).

The Mongo password is **not** in GitHub. Set `MONGODB_URI` in `Telemetry/.env` on the droplet.

## Minimum droplet

| Setting | Minimum | Why |
|---------|---------|-----|
| Plan | **Basic, 2 GB RAM / 1 vCPU** (`s-1vcpu-2gb`) | Node 22 + mongoose + GT06. 1 GB often OOMs. |
| Region | **Bangalore (BLR1)** | Same region as `db-mdb-blr1-25924`. |
| Image | **Ubuntu 24.04 LTS** | Docker + Node 22. |
| Disk | Default (~50 GB) | SQLite config is small; GPS lives in Mongo. |
| Networking | Public IPv4 | Trackers must reach this host. |

## Mongo trusted sources

In **Databases → db-mdb-blr1-25924 → Trusted sources**, add the App Platform app and this droplet. Do not open the cluster to `0.0.0.0/0`.

## Firewall

| Port | Protocol | Source | Use |
|------|----------|--------|-----|
| 22 | TCP | Your IP | SSH |
| 4200 | TCP | Optional | HTTP health / ingest |
| 4210 | TCP | Devices | JSON GPS TCP |
| 21100 | TCP | Devices | WanWay / GT06 |
| 5001 | TCP | Devices | WanWay |
| 8821 | TCP | Devices | WanWay |

## Deploy

On 2 GB RAM, create swap first. Without it, `npm` is killed and Docker reports `Exit handler never called`.

```bash
fallocate -l 2G /swapfile
chmod 600 /swapfile
mkswap /swapfile
swapon /swapfile
echo '/swapfile none swap sw 0 0' | tee -a /etc/fstab

apt-get update
apt-get install -y ca-certificates curl git
curl -fsSL https://get.docker.com | sh

git clone https://github.com/megalasai/Telemetry.git
cd Telemetry
cp .env.example .env
nano .env
```

Put the real password in `MONGODB_URI`. Keep `LOCATION_API_URL` and `PLATFORM_API_URL` pointing at the App Platform app.

```bash
docker compose up -d --build
curl -s http://127.0.0.1:4200/health
docker compose logs -f
```

Point WanWay devices at this droplet’s public IP, port `21100` (or `5001` / `8821`). Register the IMEI in admin **IoT Devices** as vendor WanWay.

## Update later

```bash
cd Telemetry
git pull
docker compose up -d --build
```
