# Backups and restore

This covers the Docker deployment ([deployment.md](deployment.md#option-a-vps-with-docker)). On
Vercel with a managed database, use the provider's backups and point-in-time restore.

## What is backed up

The `scheduler` container runs `docker/scheduler/backup.sh` **every day at 02:30 IST**, and once
when it first starts. Each run makes:

| File                                   | Contents                                                                                                       |
| -------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| `backups/db_<date>_<time>.dump`        | The whole database: products, orders, customers and settings (`pg_dump` custom format)                         |
| `backups/uploads_<date>_<time>.tar.gz` | Images uploaded to the server's disk. Only made when there are any; with Cloudinary, images live there instead |

- **Retention:** files stay in `~/store/backups` on the server for `BACKUP_KEEP_DAYS` (default 14)
  days.
- **Health check:** the scheduler turns **unhealthy** if no backup has succeeded for 26 hours.
  `docker compose -f docker-compose.prod.yml ps` shows it, and so does any monitoring that
  watches container health.

Secrets in `.env` are **not** backed up. Keep a copy of `.env` in a password manager: without
`AUTH_SECRET` and the VAPID keys, sessions and push subscriptions are lost.

## Off-server copies (recommended)

A backup that only lives on the server is lost together with the server. Set an S3-compatible
bucket in `.env`, and every backup is also uploaded there:

```env
BACKUP_S3_BUCKET=store-backups
BACKUP_S3_PREFIX=kaveri-handlooms           # one folder per store
BACKUP_S3_ENDPOINT=https://<account>.r2.cloudflarestorage.com   # empty for AWS S3
BACKUP_S3_REGION=auto                        # AWS: e.g. ap-south-1
BACKUP_S3_ACCESS_KEY_ID=...
BACKUP_S3_SECRET_ACCESS_KEY=...
```

Then run `docker compose -f docker-compose.prod.yml up -d`.

- **Providers:** Cloudflare R2 (no download fees), Backblaze B2 and AWS S3 all work.
- **Key permissions:** give the key write access to that bucket only.
- **Remote retention:** add a **lifecycle rule** on the bucket (for example, delete after 30 or
  90 days). The script doesn't delete remote copies.

## Checking backups

```sh
cd ~/store
ls -lh backups/                                   # newest files, sizes
cat backups/.last-success                         # time of the last good backup
docker compose -f docker-compose.prod.yml logs scheduler | grep backup
docker compose -f docker-compose.prod.yml exec scheduler backup.sh    # back up now
```

Test a restore every few months, preferably on a spare server. A backup that has never been
restored is only a hope.

## Restore

A restore **replaces all data** in the database with the backup. Orders placed after the backup
are lost. Before a risky restore, take a fresh backup with `exec scheduler backup.sh`.

1. Stop the app, so no orders arrive while the database is being replaced:
   ```sh
   cd ~/store
   docker compose -f docker-compose.prod.yml stop app
   ```
2. Restore. Name the database file, and optionally the uploads file from the same run. Without
   `--yes` the script only says what it would do:
   ```sh
   docker compose -f docker-compose.prod.yml exec scheduler \
     restore.sh db_2026-10-01_023000.dump uploads_2026-10-01_023000.tar.gz --yes
   ```
   Files missing from `backups/` are downloaded from the S3 bucket when one is configured.
3. Start the app and refresh its page cache:
   ```sh
   docker compose -f docker-compose.prod.yml start app
   docker compose -f docker-compose.prod.yml exec scheduler refresh-cache.sh
   ```
4. Open the store and the admin, and check the latest orders and a product page.

### Restoring onto a new server

1. Set up the server as in [deployment.md](deployment.md), using the **same `.env`** as before.
2. Copy the backup files into `~/store/backups/`, or rely on the S3 settings to fetch them.
3. Start the stack with `docker compose -f docker-compose.prod.yml up -d`. Migrations create an
   empty schema.
4. Restore with steps 1–3 above. Don't run `pnpm setup:store`; the backup already contains the
   store.
5. Point the domain's DNS at the new server.

### Restoring a single table or order

`pg_restore` can read one table from a dump into a scratch database, from which you copy rows by
hand. This needs care, so ask your developer:

```sh
docker compose -f docker-compose.prod.yml exec postgres createdb -U ecom scratch
docker compose -f docker-compose.prod.yml exec scheduler \
  pg_restore --no-owner --dbname=scratch /backups/db_2026-10-01_023000.dump
```
