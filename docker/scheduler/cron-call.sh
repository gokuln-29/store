#!/bin/sh
# Calls one /api/cron/<job> endpoint of the app with the shared secret.
set -u
job="$1"
if out=$(curl -fsS -m 120 -H "Authorization: Bearer ${CRON_SECRET:?CRON_SECRET is not set}" \
  "${APP_INTERNAL_URL:-http://app:3000}/api/cron/$job" 2>&1); then
  echo "{\"level\":\"info\",\"scope\":\"cron\",\"job\":\"$job\",\"result\":$out}"
else
  echo "{\"level\":\"error\",\"scope\":\"cron\",\"job\":\"$job\",\"msg\":\"request failed\"}" >&2
  echo "$out" >&2
  exit 1
fi
