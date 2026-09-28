#!/bin/sh
# Restores a database dump (and optionally an uploads archive) made by backup.sh.
#   restore.sh db_2026-01-31_023000.dump [uploads_2026-01-31_023000.tar.gz] --yes
# Files are looked up in $BACKUP_DIR, or downloaded from s3://$BACKUP_S3_BUCKET when missing.
# Stop the app first: docker compose -f docker-compose.prod.yml stop app
set -eu
db=""; up=""; yes=""
for arg in "$@"; do
  case "$arg" in
    --yes) yes=1 ;;
    *.dump) db="$arg" ;;
    *.tar.gz) up="$arg" ;;
    *) echo "Unknown argument: $arg" >&2; exit 2 ;;
  esac
done
[ -n "$db" ] || { echo "Usage: restore.sh <db_*.dump> [uploads_*.tar.gz] --yes" >&2; exit 2; }

fetch() {
  local_path="$BACKUP_DIR/$(basename "$1")"
  if [ ! -f "$local_path" ]; then
    [ -n "${BACKUP_S3_BUCKET:-}" ] || { echo "$local_path not found" >&2; exit 1; }
    endpoint=""
    [ -n "${BACKUP_S3_ENDPOINT:-}" ] && endpoint="--endpoint-url $BACKUP_S3_ENDPOINT"
    # shellcheck disable=SC2086
    aws s3 cp --only-show-errors $endpoint "s3://$BACKUP_S3_BUCKET/${BACKUP_S3_PREFIX:-store}/$(basename "$1")" "$local_path"
  fi
  echo "$local_path"
}

db_path=$(fetch "$db")
if [ -z "$yes" ]; then
  echo "This REPLACES all data in database '$PGDATABASE' on '$PGHOST' with $db_path."
  echo "Run again with --yes to continue."
  exit 1
fi

pg_restore --clean --if-exists --no-owner --no-privileges --single-transaction --dbname="$PGDATABASE" "$db_path"
echo "Database restored from $db_path"

if [ -n "$up" ]; then
  up_path=$(fetch "$up")
  [ -d /uploads ] || { echo "/uploads is not mounted" >&2; exit 1; }
  find /uploads -mindepth 1 -delete
  tar -xzf "$up_path" -C /uploads
  chown -R 1001:1001 /uploads   # the app runs as uid 1001 (see Dockerfile)
  echo "Uploads restored from $up_path"
fi

echo "Done. Start the app and refresh its page cache:"
echo "  docker compose -f docker-compose.prod.yml start app"
echo "  docker compose -f docker-compose.prod.yml exec scheduler refresh-cache.sh"
