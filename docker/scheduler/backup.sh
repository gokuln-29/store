#!/bin/sh
# Daily backup: database dump (pg_dump custom format) and, when images are stored on disk, the
# uploads folder. Kept BACKUP_KEEP_DAYS days locally; copied to S3-compatible storage when
# BACKUP_S3_BUCKET is set. Restore with restore.sh (see docs/backups.md).
set -eu
: "${PGHOST:?}" "${PGUSER:?}" "${PGDATABASE:?}"
ts=$(date +%Y-%m-%d_%H%M%S)
dir="$BACKUP_DIR"
mkdir -p "$dir"
log() { echo "{\"level\":\"$1\",\"scope\":\"backup\",\"msg\":\"$2\"}"; }
trap 'log error "backup failed"; rm -f "$dir"/*.partial' EXIT

db_file="$dir/db_$ts.dump"
pg_dump --format=custom --no-owner --no-privileges --file="$db_file.partial"
mv "$db_file.partial" "$db_file"
files="$db_file"

if [ -d /uploads ] && [ -n "$(ls -A /uploads 2>/dev/null)" ]; then
  up_file="$dir/uploads_$ts.tar.gz"
  tar -czf "$up_file.partial" -C /uploads .
  mv "$up_file.partial" "$up_file"
  files="$files $up_file"
fi

if [ -n "${BACKUP_S3_BUCKET:-}" ]; then
  endpoint=""
  [ -n "${BACKUP_S3_ENDPOINT:-}" ] && endpoint="--endpoint-url $BACKUP_S3_ENDPOINT"
  for f in $files; do
    # shellcheck disable=SC2086
    aws s3 cp --only-show-errors $endpoint "$f" "s3://$BACKUP_S3_BUCKET/${BACKUP_S3_PREFIX:-store}/$(basename "$f")"
  done
fi

find "$dir" -maxdepth 1 \( -name 'db_*.dump' -o -name 'uploads_*.tar.gz' \) -mtime +"$BACKUP_KEEP_DAYS" -delete
date -Iseconds > "$dir/.last-success"
trap - EXIT
names=""
for f in $files; do names="$names $(basename "$f")"; done
log info "backup done:$names"
