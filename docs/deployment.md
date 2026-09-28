# Deployment

This guide covers two ways to run a store in production. Each client store is its own
deployment, with its own database, secrets and domain.

|                      | **VPS with Docker** (recommended)                                                 | **Vercel**                                                 |
| -------------------- | --------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| What runs where      | Postgres, the app, HTTPS (Caddy), cron jobs and backups on one server             | App on Vercel; Postgres from a managed provider            |
| Cost                 | One server, from about ₹500–1,500/month (2 GB RAM or more)                        | Vercel Pro plus a database plan                            |
| Images               | Stored on the server's disk, or Cloudinary                                        | Cloudinary is **required** (Vercel has no persistent disk) |
| Cron every 5 minutes | Built in (scheduler container)                                                    | Needs Vercel Pro or an external cron service               |
| Backups              | Built in: daily, kept 14 days, optionally copied to S3 ([backups.md](backups.md)) | Use your database provider's backups                       |

Before going live, work through the go-live checklist in
[security-checklist.md](security-checklist.md#go-live-checklist).

---

## Option A: VPS with Docker

### What you need

- **Server:** Ubuntu 24.04 (or any Linux with Docker), 2 vCPU, 2 GB RAM or more, 25 GB disk.
  Pick a data centre in India (Mumbai, Bangalore or Chennai) for fast pages.
- **Docker:** Docker Engine with the Compose plugin (`docker compose version` works).
- **Domain:** an **A record** (and AAAA for IPv6) pointing at the server's IP, e.g.
  `shop.example.in → 203.0.113.10`. DNS changes can take up to an hour.
- **Firewall:** ports **22, 80 and 443** open, and nothing else. Postgres is not published on
  the host.

Building the image needs about 4 GB of memory. On a smaller server, either let GitHub build it
(see [CI/CD](#cicd), recommended), or add swap once:

```sh
sudo fallocate -l 4G /swapfile && sudo chmod 600 /swapfile && sudo mkswap /swapfile
sudo swapon /swapfile && echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
```

### 1. Get the code and configure

```sh
git clone <your store repository> ~/store && cd ~/store
cp .env.example .env
```

Edit `.env`. At minimum, set these:

| Variable                | Value                                                                                                  |
| ----------------------- | ------------------------------------------------------------------------------------------------------ |
| `DOMAIN`                | `shop.example.in` (no `https://`)                                                                      |
| `ACME_EMAIL`            | An email address that Let's Encrypt can write to about certificates                                    |
| `NEXT_PUBLIC_APP_URL`   | `https://shop.example.in`                                                                              |
| `POSTGRES_PASSWORD`     | `openssl rand -hex 24`                                                                                 |
| `AUTH_SECRET`           | `openssl rand -base64 32`                                                                              |
| `CRON_SECRET`           | `openssl rand -hex 24`                                                                                 |
| `AUTH_TRUST_HOST`       | `true`                                                                                                 |
| `PAYMENT_PROVIDER`      | `razorpay` for real payments. While setting up, use `mock` with `ALLOW_MOCK_PAYMENTS=true`             |
| `VAPID_*`               | Generate with `pnpm exec web-push generate-vapid-keys` on any machine with the repo ([pwa.md](pwa.md)) |
| `NEXT_PUBLIC_ENABLE_SW` | `true` (installable app, offline pages)                                                                |
| Email, SMS              | See [orders.md](orders.md#customer-notifications)                                                      |

Notes:

- `DATABASE_URL` is built by `docker-compose.prod.yml` from `POSTGRES_*`. Don't set it in `.env`
  on the server.
- `NEXT_PUBLIC_*` values are compiled into the browser code. After changing one, rebuild the
  image (or push again, if GitHub builds it). Every other variable only needs a restart.

### 2. Start

```sh
docker compose -f docker-compose.prod.yml up -d --build
```

This command:

1. builds the images (skipped if you use images from GitHub, see [CI/CD](#cicd));
2. starts Postgres;
3. applies database migrations (the `migrate` service; the app waits for it);
4. starts the app, Caddy and the scheduler.

Caddy gets the HTTPS certificate on the first request, which takes a few seconds.

Check that everything is running:

```sh
docker compose -f docker-compose.prod.yml ps        # app and scheduler should be "healthy"
curl https://shop.example.in/api/health             # {"status":"ok","db":"ok",...}
```

### 3. Set up the store

```sh
docker compose -f docker-compose.prod.yml run --rm migrate pnpm setup:store
```

The script asks for:

- the store name and languages;
- the owner's login;
- contact details;
- GST state, GSTIN and rate;
- cash on delivery and the delivery charge.

It creates the settings, the owner account, one shipping rule and a "New arrivals" home section.
It does **not** create demo products. It refuses to run a second time; `--force` overwrites the
settings and the owner's password.

For an unattended run, set the `SETUP_*` variables listed in `.env.example` and pass `--yes`.

Then sign in at `https://shop.example.in/en/admin/login` and continue with
[CLIENT_ONBOARDING.md](CLIENT_ONBOARDING.md).

### Everyday commands

All commands run from `~/store` and are prefixed with `docker compose -f docker-compose.prod.yml`:

| Task                          | Command                                                                                  |
| ----------------------------- | ---------------------------------------------------------------------------------------- |
| Logs (JSON lines)             | `logs -f app` / `logs -f scheduler` / `logs caddy`                                       |
| Restart after changing `.env` | `up -d` (only containers whose settings changed are recreated)                           |
| Update to a new version       | `git pull && docker compose -f docker-compose.prod.yml up -d --build`                    |
| Database shell                | `exec postgres psql -U ecom ecom`                                                        |
| Back up now                   | `exec scheduler backup.sh`                                                               |
| Restore                       | See [backups.md](backups.md#restore)                                                     |
| Stop everything               | `down` (data is kept in Docker volumes; **never** add `-v` unless you mean to delete it) |

Migrations run automatically on every `up`.

**Uploads.** Images uploaded without Cloudinary are stored in the `uploads` volume and backed up
with the database.

---

## Option B: Vercel

1. **Database.** Create a Postgres database in the **Mumbai** region (Neon, Supabase, or another
   provider).
   - Use its **pooled** connection string for `DATABASE_URL`, and set `DATABASE_POOL_MAX=1`.
   - Every serverless instance opens its own connections, so a direct connection string runs out
     of connections under load.
2. **Images.** Create a Cloudinary account and set the `CLOUDINARY_*` variables. Uploads made
   without Cloudinary are lost on Vercel.
3. **Project.** Import the repository in Vercel (framework: Next.js). `vercel.json` already sets:
   - **build command:** `prisma migrate deploy && next build`, so migrations run on every deploy;
   - **region:** Mumbai (`bom1`);
   - **cron jobs:** listed in step 5.
4. **Environment variables.** Add everything from `.env.example` that applies, under
   Settings → Environment Variables:
   - `NEXT_PUBLIC_APP_URL` must be the production URL;
   - `AUTH_TRUST_HOST` isn't needed on Vercel.
5. **Cron jobs.** Vercel Hobby runs cron at most once a day, which is what `vercel.json` sets.
   - Online orders that nobody pays are still cancelled when someone next opens them.
   - For the intended **every 5 minutes**:
     - on **Vercel Pro**, change both schedules in `vercel.json` to `*/5 * * * *`;
     - or call the endpoints from an external scheduler such as cron-job.org, with the header
       `Authorization: Bearer <CRON_SECRET>`:
       - `https://<domain>/api/cron/expire-orders`
       - `https://<domain>/api/cron/send-notifications`
   - Vercel's own cron sends `CRON_SECRET` automatically.
6. **Deploy, then set up the store** from your computer against the production database:
   ```sh
   DATABASE_URL="<production connection string>" pnpm setup:store
   ```
   Add `NEXT_PUBLIC_APP_URL` and `CRON_SECRET` to the same command line, and the script also
   refreshes pages Vercel has already cached.
7. **Domain.** Vercel → Settings → Domains → add the domain, then create the DNS record Vercel
   shows. The certificate is automatic.

---

## Custom domain and HTTPS

- **VPS.** Point the A/AAAA record at the server, set `DOMAIN` and `ACME_EMAIL`, and start the
  stack. Caddy gets a Let's Encrypt certificate and renews it on its own.
  - HTTP redirects to HTTPS.
  - HSTS is sent by the app (2 years), so only enable a domain once HTTPS works.
- **www.** To also serve `www.<domain>`, create its DNS record and uncomment the `www` block in
  `docker/Caddyfile`. It redirects to the main domain.
- **Visitor IP.** Caddy sets `X-Real-IP` to the connecting IP and replaces any value the
  visitor sent. Rate limits use it, so it can't be faked.
- **Cloudflare in front.**
  - Use SSL mode **Full (strict)**; the "Flexible" mode causes redirect loops.
  - Point the rate limits at the visitor rather than at Cloudflare: in `docker/Caddyfile`, change
    `{remote_host}` to `{http.request.header.CF-Connecting-IP}`.
  - Allow ports 80/443 only from
    [Cloudflare's IP ranges](https://www.cloudflare.com/ips/). Otherwise anyone can reach the
    server directly and send a fake header.
- **Changing the domain later.**
  1. Update `DOMAIN` and `NEXT_PUBLIC_APP_URL`.
  2. Rebuild.
  3. Update the Razorpay webhook URL.
  4. Resubmit the sitemap in Google Search Console.

  Push subscriptions belong to the old domain; customers opt in again.

## Razorpay: switching to live mode

Test mode is described in [payments.md](payments.md#setup-test-mode). To go live:

1. **Razorpay.** Finish KYC in the Razorpay Dashboard until the account is **activated**, then
   switch the Dashboard to **Live mode**.
2. **Keys.** Account & Settings → API Keys → **Generate live key**. Put the keys in the
   production environment, replacing the test keys:
   ```env
   PAYMENT_PROVIDER=razorpay
   RAZORPAY_KEY_ID=rzp_live_xxxxxxxxxxxx
   RAZORPAY_KEY_SECRET=xxxxxxxxxxxxxxxxxxxxxxxx
   ```
   Remove `ALLOW_MOCK_PAYMENTS`.
3. **Webhook.** In live mode, Account & Settings → Webhooks → **Add new webhook**. Test-mode
   webhooks don't carry over.
   - URL: `https://<domain>/api/webhooks/razorpay`
   - Secret: a new `openssl rand -hex 32`, also set as `RAZORPAY_WEBHOOK_SECRET`
   - Events: `payment.captured`, `payment.failed`, `payment.authorized`, `refund.processed`,
     `refund.failed`
4. **Apply the change.**
   - VPS: `docker compose -f docker-compose.prod.yml up -d`
   - Vercel: redeploy
5. **Switch on payments.** In the admin: Settings → Payments → **Online payments** on.
6. **Test with real money.** Pay a small real order (₹1–10 through a test product), check that
   it appears as paid, then refund it from Admin → Payments. In Razorpay → Webhooks, the
   deliveries should show `200`.

The complete checklist is in [payments.md](payments.md#going-live-checklist).

## CI/CD

`.github/workflows/ci.yml` runs on every push and pull request:

- translation check;
- lint;
- typecheck;
- unit and integration tests;
- a production build.

`.github/workflows/docker.yml` runs after CI passes on `main`, and for `v*` tags:

- It builds the image and pushes it to GitHub Container Registry, as
  `ghcr.io/<owner>/<repo>:latest` and `:tools-latest`, plus a `sha-…` tag for rollbacks.
- It sets the build values from repository **variables** (Settings → Secrets and variables →
  Actions → Variables): `NEXT_PUBLIC_APP_URL`, and optionally `NEXT_PUBLIC_SENTRY_DSN`,
  `NEXT_PUBLIC_SENTRY_ENVIRONMENT`, `SENTRY_ORG` and `SENTRY_PROJECT`.

To use these images on the server, add them to `.env`:

```env
APP_IMAGE=ghcr.io/<owner>/<repo>:latest
TOOLS_IMAGE=ghcr.io/<owner>/<repo>:tools-latest
```

To pull them, the server needs to log in once, using a GitHub token with `read:packages`:
`docker login ghcr.io`. Then pull and start them:
`docker compose -f docker-compose.prod.yml pull app migrate && docker compose -f docker-compose.prod.yml up -d`.

### Automatic deploys (optional)

The `deploy` job runs only when the repository variable **`DEPLOY_HOST`** is set. It connects
over SSH and then:

1. pulls the repository;
2. pulls the new images;
3. runs `up -d`.

| Setting          | Type     | Value                                                                    |
| ---------------- | -------- | ------------------------------------------------------------------------ |
| `DEPLOY_HOST`    | variable | Server IP or hostname                                                    |
| `DEPLOY_USER`    | variable | SSH user, in the `docker` group (default `deploy`)                       |
| `DEPLOY_PATH`    | variable | Folder with the checkout (default `~/store`)                             |
| `DEPLOY_PORT`    | variable | SSH port (default 22)                                                    |
| `DEPLOY_SSH_KEY` | secret   | Private key whose public key is in the server's `~/.ssh/authorized_keys` |

The job uses the GitHub environment **production**. Add required reviewers there if deploys
should wait for approval.

To roll back, set `APP_IMAGE=ghcr.io/<owner>/<repo>:sha-<commit>` and run `up -d`. Migrations
only move forward, so roll back to a commit that has the same migrations.

### Sentry source maps

Without source maps, errors are still reported, but with minified stack traces. The CI image
doesn't upload them, because build arguments are stored in the image metadata and the token
must not be.

To upload source maps:

- **Vercel:** set `SENTRY_AUTH_TOKEN` in Vercel.
- **Docker:** build on the server with the token:
  `docker compose -f docker-compose.prod.yml build --build-arg SENTRY_AUTH_TOKEN=… app`. Only
  the build stage sees it; the final image doesn't contain it.

## How the Docker image works

- **One image serves any store.** Everything except `NEXT_PUBLIC_*` is read at runtime.
- **Build-time prerendering.** At build time, pages are prerendered against a throwaway, empty
  Postgres inside the build. The build never needs your database and never contains your data.
- **Container start.** `docker/app/entrypoint.sh` deletes those prerendered pages. Each page
  then renders from the real database on its first request, and is cached as usual after that.
- **Page cache after outside changes.** When data changes outside the app (`setup:store`,
  restoring a backup), the app's page cache is refreshed through
  `POST /api/internal/revalidate`, which requires the `CRON_SECRET`.
- **Security.** The app runs as a non-root user. `/api/health` checks the database and is used
  by the container health check.
