# Deploying the portfolio demo on a Hostinger VPS

This guide puts Neo Store online as a **public demo** that clients can explore. It takes about 30
minutes, most of it waiting for DNS and the first build.

In demo mode, visitors can do the following:

- browse, search and add to cart;
- sign in with **any mobile number and the code 123456** (no SMS is sent);
- place orders with **test payments** (no money moves);
- open the admin panel with a **view-only demo login** that is shown on the admin sign-in page.
  They see the dashboard, orders, products and settings, but can't change anything.

Your own owner login keeps full access and is never shown on the site.

## What you need

- **VPS:** Hostinger KVM 2 or larger (8 GB RAM), Ubuntu 24.04. The OS template "Ubuntu 24.04
  with Docker" saves a step, but plain Ubuntu works too.
- **Domain:** a domain or subdomain, e.g. `neostore.yourname.in`.
- **Code:** a GitHub account with this project in a private repository.

## 1. Prepare the VPS (hPanel)

1. Open **hPanel → VPS**. Choose the OS template **Ubuntu 24.04 with Docker**, or plain Ubuntu.
   Set a root password or add your SSH key.
2. Note the server's **IP address**, shown on the VPS overview.
3. **Firewall:** if you use hPanel's VPS firewall (VPS → Security → Firewall), allow ports
   **22, 80 and 443** (TCP), and **443 UDP** for HTTP/3. The setup script also configures the
   server's own firewall (ufw).

## 2. Point your domain at the VPS

Add an **A record** where your domain's DNS is managed:

- Hostinger domains: **hPanel → Domains → your domain → DNS / Nameservers**.

| Type | Name                                                                | Points to  | TTL |
| ---- | ------------------------------------------------------------------- | ---------- | --- |
| A    | `neostore` (for `neostore.yourname.in`), or `@` for the bare domain | the VPS IP | 300 |

Delete any other A or AAAA record with the same name. DNS usually updates within 5–30 minutes.
Check it from your computer with `nslookup neostore.yourname.in`.

## 3. Get the code onto the VPS

Connect to the server:

```sh
ssh root@<VPS-IP>
```

Give the server read-only access to your private GitHub repository (a **deploy key**):

```sh
ssh-keygen -t ed25519 -C "neostore-vps" -f ~/.ssh/id_ed25519 -N ""
cat ~/.ssh/id_ed25519.pub
```

In GitHub, open the repository → **Settings → Deploy keys → Add deploy key**. Paste the key,
leave "Allow write access" off, and save. Then clone:

```sh
git clone git@github.com:<you>/<repo>.git ~/neostore
cd ~/neostore
```

## 4. Run the setup

```sh
sudo bash scripts/hostinger-setup.sh
```

It asks three things:

- **the domain**, e.g. `neostore.yourname.in`;
- **your email**, used for HTTPS certificate notices and as your owner login;
- **an owner password**, at least 10 characters.

Then it:

1. installs Docker (if needed) and opens ports 22/80/443;
2. writes `.env` with fresh random secrets, in demo mode;
3. builds the images (5–10 minutes the first time);
4. creates push-notification keys;
5. starts the database, the app, HTTPS (Caddy) and the scheduler (cron jobs and daily backups);
6. loads the demo catalogue.

At the end it prints the links and logins. Open `https://<your-domain>`. The first visit takes a
few seconds while the HTTPS certificate is issued.

**Save `~/neostore/.env` in your password manager.** It holds the secrets that logins and
backups depend on.

## 5. Share it

- **Store:** `https://<your-domain>` (add `/ta` or `/kn` for Tamil or Kannada).
- **Admin:** `https://<your-domain>/en/admin/login`. The view-only demo login is shown on that
  page.
- **Customer demo:** any mobile number with code `123456`.

A yellow banner on every page tells visitors it's a demo and asks them not to enter real
personal details.

## Updating

Push your changes to GitHub from your computer, then on the VPS:

```sh
cd ~/neostore && sudo bash scripts/hostinger-update.sh
```

This pulls the code, rebuilds, applies database migrations and restarts. Data, uploads and
backups are kept.

## Everyday commands

Run these on the VPS, in `~/neostore`:

| Task                      | Command                                                                   |
| ------------------------- | ------------------------------------------------------------------------- |
| Status                    | `docker compose -f docker-compose.prod.yml ps`                            |
| App logs                  | `docker compose -f docker-compose.prod.yml logs -f app`                   |
| HTTPS logs                | `docker compose -f docker-compose.prod.yml logs caddy`                    |
| Backup now                | `docker compose -f docker-compose.prod.yml exec scheduler backup.sh`      |
| Reload the demo catalogue | `docker compose -f docker-compose.prod.yml run --rm migrate pnpm db:seed` |
| Restart                   | `docker compose -f docker-compose.prod.yml restart app`                   |

Backups run every night at 02:30 IST into `~/neostore/backups` and are kept 14 days. To also copy
them off the server, see [backups.md](backups.md).

## Troubleshooting

| Problem                                                | Fix                                                                                                                                                        |
| ------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| The browser says the site isn't secure / can't connect | Check that DNS points to the VPS (`nslookup`), then `docker compose -f docker-compose.prod.yml logs caddy`. Caddy retries automatically once DNS is right. |
| Setup stops at "the app did not become healthy"        | `docker compose -f docker-compose.prod.yml logs app` shows why. Fix `.env` if needed and run the setup again (it's safe to repeat).                        |
| The build is killed                                    | The server ran out of memory. Use KVM 2 or larger; on smaller plans the script adds swap automatically.                                                    |
| Forgot the owner password                              | `docker compose -f docker-compose.prod.yml run --rm migrate pnpm reset:password` asks for the email and a new password.                                    |

## Turning the demo into a real store

Set `DEMO_MODE=false`, and set up real payments, SMS and email as described in
[deployment.md](deployment.md) and [CLIENT_ONBOARDING.md](CLIENT_ONBOARDING.md). Then run
`docker compose -f docker-compose.prod.yml up -d`.

For a client's store, start from a fresh database with `pnpm setup:store`, not the demo
catalogue.
