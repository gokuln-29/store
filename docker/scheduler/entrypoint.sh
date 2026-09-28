#!/bin/sh
set -eu
# crond runs jobs without the container environment; save it for them.
export -p > /run/scheduler.env
chmod 600 /run/scheduler.env
# First start: take a backup straight away so the health check has something to go on.
if [ "${1:-}" = "crond" ] && [ ! -f "$BACKUP_DIR/.last-success" ]; then
  backup.sh || echo '{"level":"error","scope":"backup","msg":"initial backup failed"}' >&2
fi
exec "$@"
