#!/bin/sh
# Asks the app to re-render its cached pages, e.g. after restore.sh:
#   docker compose -f docker-compose.prod.yml exec scheduler refresh-cache.sh
set -u
if curl -fsS -m 30 -X POST -H "Authorization: Bearer ${CRON_SECRET:?CRON_SECRET is not set}" \
  "${APP_INTERNAL_URL:-http://app:3000}/api/internal/revalidate" >/dev/null; then
  echo "App page cache refreshed."
else
  echo "Couldn't reach the app. Start it, then run refresh-cache.sh again." >&2
  exit 1
fi
