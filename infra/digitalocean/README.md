# Digi-Switchride POC on DigitalOcean

One droplet runs MongoDB, the admin web portal, the API, the India location finder, and telemetry. Split hosts and Managed MongoDB later using `docs/deployment/digitalocean-plan.md`.

## Resources (POC)

| Item | Size |
|------|------|
| Droplet | Ubuntu 24.04, **2 vCPU / 4 GB / 80 GB** (`s-2vcpu-4gb`) in `blr1` |
| Firewall | 22, 80, 443, 3000, 4000, 4100, 4200, 4210 |
| Backups | Droplet backups on (optional) |

Skip Managed MongoDB, load balancer, and a second droplet until you leave POC.

## Create the droplet

1. DigitalOcean → Create → Droplets.
2. Image: Ubuntu 24.04. Region: Bangalore (`blr1`) if the fleet is in India.
3. Size: Basic Regular **4 GB RAM**.
4. SSH key (do not use a password).
5. Hostname: `switchride-poc`. Enable monitoring.

## Install Docker and open ports

Copy the repo to the droplet, then:

```bash
sudo bash /opt/digi-switchride/infra/digitalocean/bootstrap-droplet.sh
```

Or install Docker yourself (`curl -fsSL https://get.docker.com | sh`) and open the ports listed above.

## Configure secrets

```bash
cd /opt/digi-switchride
cp infra/digitalocean/env.poc.example infra/digitalocean/.env.poc
nano infra/digitalocean/.env.poc
```

Set at least:

- `PUBLIC_ORIGIN=http://YOUR_DROPLET_IP:3000`
- `JWT_SECRET` (32+ random characters)
- `ADMIN_PASSWORD` (not the local default)
- `TELEMETRY_HTTP_API_KEY`
- Track360 user/password if you want live GPS on the POC

## Start the stack

From the repository root on the droplet:

```bash
docker compose -f infra/digitalocean/docker-compose.poc.yml --env-file infra/digitalocean/.env.poc up -d --build
docker compose -f infra/digitalocean/docker-compose.poc.yml ps
docker compose -f infra/digitalocean/docker-compose.poc.yml logs -f location
```

Location downloads GeoNames on first start and writes `/data/india.sqlite`. Wait until `/health` is OK (5–15 minutes). OSM import is **not** run on POC; add it later if you need street names.

## URLs (IP, no TLS)

| App | URL |
|-----|-----|
| Admin web | `http://DROPLET_IP:3000` |
| API | `http://DROPLET_IP:4000/api/health` |
| Location | `http://DROPLET_IP:4100/health` |
| Telemetry HTTP | `http://DROPLET_IP:4200/health` |
| Telemetry TCP | `DROPLET_IP:4210` |

Sign in with `ADMIN_EMAIL` / `ADMIN_PASSWORD` from `.env.poc`. Leave Organisation empty for SuperAdmin.

## HTTPS later (still one droplet)

1. Point DNS A records at the droplet: `poc.example.com`, `api.poc.example.com`, `location.poc.example.com`, `telemetry.poc.example.com`.
2. Set `POC_DOMAIN=poc.example.com` and `PUBLIC_ORIGIN=https://poc.example.com` in `.env.poc`.
3. Start Caddy:

```bash
docker compose -f infra/digitalocean/docker-compose.poc.yml --env-file infra/digitalocean/.env.poc --profile tls up -d
```

## Smoke checks

```bash
curl -s http://127.0.0.1:4000/api/health
curl -s http://127.0.0.1:4100/health
curl -s http://127.0.0.1:4200/health
```

In the browser: login → dashboard map → IoT devices → riders.

## Stop / update

```bash
docker compose -f infra/digitalocean/docker-compose.poc.yml --env-file infra/digitalocean/.env.poc pull
docker compose -f infra/digitalocean/docker-compose.poc.yml --env-file infra/digitalocean/.env.poc up -d --build
```

Volumes (`mongo_data`, `location_data`, `telemetry_data`) are kept. Do not delete them unless you intend to wipe the POC.

## When you make it big

Keep the same images. Move Mongo to Managed MongoDB, split `location` + `telemetry` onto a second droplet, and put Caddy or a Load Balancer in front. Details are in `docs/deployment/digitalocean-plan.md` Phase B.
