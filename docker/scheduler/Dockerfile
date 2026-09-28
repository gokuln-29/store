# Scheduler: calls the app's cron endpoints and makes daily database + uploads backups.
# Same Postgres major version as the database, so pg_dump/pg_restore always match.
FROM postgres:17-alpine
RUN apk add --no-cache curl aws-cli tzdata
ENV TZ=Asia/Kolkata \
    BACKUP_DIR=/backups \
    BACKUP_KEEP_DAYS=14
COPY crontab /etc/crontabs/root
COPY entrypoint.sh backup.sh restore.sh cron-call.sh refresh-cache.sh /usr/local/bin/
RUN chmod +x /usr/local/bin/*.sh && mkdir -p /backups
# Unhealthy when the last successful backup is older than 26 hours.
HEALTHCHECK --interval=10m --timeout=10s --start-period=10m \
    CMD find /backups/.last-success -mmin -1560 | grep -q . || exit 1
ENTRYPOINT ["entrypoint.sh"]
CMD ["crond", "-f", "-l", "6"]
