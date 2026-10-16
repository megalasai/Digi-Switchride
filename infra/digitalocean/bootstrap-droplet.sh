#!/usr/bin/env bash
# Run on a fresh Ubuntu 24.04 droplet as root (or with sudo).
set -euo pipefail

if [[ $EUID -ne 0 ]]; then
  echo "Run as root: sudo bash infra/digitalocean/bootstrap-droplet.sh"
  exit 1
fi

export DEBIAN_FRONTEND=noninteractive
apt-get update
apt-get install -y ca-certificates curl git ufw

if ! command -v docker >/dev/null 2>&1; then
  curl -fsSL https://get.docker.com | sh
fi
systemctl enable --now docker

ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp
ufw allow 3000/tcp
ufw allow 4000/tcp
ufw allow 4100/tcp
ufw allow 4200/tcp
ufw allow 4210/tcp
ufw --force enable

echo
echo "Docker is ready. On the droplet:"
echo "  1. Place the repo at /opt/digi-switchride"
echo "  2. cp /opt/digi-switchride/infra/digitalocean/env.poc.example /opt/digi-switchride/infra/digitalocean/.env.poc"
echo "  3. Edit .env.poc (JWT_SECRET, passwords, PUBLIC_ORIGIN=http://DROPLET_IP:3000)"
echo "  4. cd /opt/digi-switchride && docker compose -f infra/digitalocean/docker-compose.poc.yml --env-file infra/digitalocean/.env.poc up -d --build"
echo "First location seed can take 5–15 minutes. Then open http://DROPLET_IP:3000"
