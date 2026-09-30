#!/usr/bin/env bash
# Updates the store on the VPS to the latest commit on GitHub and restarts it.
# Migrations run automatically; data, uploads, .env and backups are kept.
#
#   sudo bash scripts/hostinger-update.sh
set -euo pipefail

cd "$(dirname "$0")/.."
COMPOSE=(docker compose -f docker-compose.prod.yml)

git pull --ff-only
"${COMPOSE[@]}" up -d --build --remove-orphans
docker image prune -f >/dev/null
"${COMPOSE[@]}" ps
echo "Updated to $(git log -1 --format='%h %s')."
