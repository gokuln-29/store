#!/usr/bin/env bash
# One-command setup of the Neo Store portfolio demo on a VPS (Ubuntu 22.04/24.04).
# Run from the repository folder on the server:
#
#   sudo bash scripts/hostinger-setup.sh
#
# Two modes, chosen automatically on the first run:
# - dedicated server (ports 80/443 free): the stack serves HTTPS itself (Caddy) and the firewall
#   is opened for SSH/HTTP/HTTPS;
# - shared server (another web server already uses 80/443): the firewall and other sites are left
#   alone, the app listens on 127.0.0.1:APP_PORT, and an Nginx site with a certbot certificate is
#   added for the store's domain (or instructions are printed for other web servers).
# Safe to run again: existing .env and data are kept. Guide: docs/hostinger.md
set -euo pipefail

cd "$(dirname "$0")/.."
COMPOSE=(docker compose -f docker-compose.prod.yml)

say() { printf '\n\033[1;35m==> %s\033[0m\n' "$*"; }
warn() { printf '\033[1;33m%s\033[0m\n' "$*"; }
die() { printf '\033[1;31mError: %s\033[0m\n' "$*" >&2; exit 1; }

[ "$(id -u)" -eq 0 ] || die "run with sudo: sudo bash scripts/hostinger-setup.sh"
[ -f docker-compose.prod.yml ] || die "run this from the repository folder"

# ---------------------------------------------------------------- Docker
say "Checking Docker"
if ! command -v docker >/dev/null 2>&1; then
  curl -fsSL https://get.docker.com | sh
fi
docker compose version >/dev/null 2>&1 || die "the Docker Compose plugin is missing (apt install docker-compose-plugin)"
systemctl enable --now docker >/dev/null 2>&1 || true

# ---------------------------------------------------------------- Swap (build needs ~4 GB)
mem_gb=$(awk '/MemTotal/ { print int($2 / 1024 / 1024) }' /proc/meminfo)
if [ "$mem_gb" -lt 6 ] && ! swapon --show | grep -q .; then
  say "Adding a 4 GB swap file (the server has ${mem_gb} GB RAM)"
  fallocate -l 4G /swapfile && chmod 600 /swapfile && mkswap /swapfile >/dev/null && swapon /swapfile
  grep -q '^/swapfile' /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab
fi

port_in_use() { ss -ltnH "( sport = :$1 )" | grep -q .; }

# ---------------------------------------------------------------- .env
rand_hex() { openssl rand -hex "$1"; }
if [ ! -f .env ]; then
  say "Creating .env"
  read -rp "Domain for the store (e.g. store.example.com): " DOMAIN
  DOMAIN=${DOMAIN#https://}; DOMAIN=${DOMAIN#http://}; DOMAIN=${DOMAIN%/}
  [ -n "$DOMAIN" ] || die "a domain is required"
  read -rp "Your email (certificate notices and the owner login): " OWNER_EMAIL
  [[ "$OWNER_EMAIL" == *@* ]] || die "a valid email is required"
  while true; do
    read -rsp "Owner password for the admin panel (at least 10 characters): " OWNER_PASSWORD; echo
    if [ "${#OWNER_PASSWORD}" -lt 10 ]; then echo "Too short, try again."
    elif [[ "$OWNER_PASSWORD" == *"'"* ]]; then echo "Please avoid the ' character."
    else break; fi
  done

  if port_in_use 80 || port_in_use 443; then
    MODE=shared
    PROFILES=""
    APP_PORT=3005
    while port_in_use "$APP_PORT"; do APP_PORT=$((APP_PORT + 1)); done
    say "Ports 80/443 are already used by another web server: sharing it (app on 127.0.0.1:${APP_PORT})"
  else
    MODE=dedicated
    PROFILES=caddy
    APP_PORT=3005
  fi

  cat > .env <<ENV
# Written by scripts/hostinger-setup.sh on $(date -u +%Y-%m-%d). Keep a copy in your password
# manager: without AUTH_SECRET and the VAPID keys, logins and push subscriptions are lost.

# ---- Server (${MODE} mode) ----
DOMAIN=${DOMAIN}
ACME_EMAIL=${OWNER_EMAIL}
COMPOSE_PROFILES=${PROFILES}
APP_PORT=${APP_PORT}
NEXT_PUBLIC_APP_URL=https://${DOMAIN}
NEXT_PUBLIC_ENABLE_SW=true
AUTH_TRUST_HOST=true
AUTH_SECRET=$(openssl rand -base64 32)
CRON_SECRET=$(rand_hex 24)
POSTGRES_USER=ecom
POSTGRES_PASSWORD=$(rand_hex 24)
POSTGRES_DB=ecom

# ---- Portfolio demo (src/lib/demo.ts): demo login code, test payments, view-only demo admin ----
DEMO_MODE=true
DEMO_ADMIN_EMAIL=demo@example.com
DEMO_ADMIN_PASSWORD=DemoAdmin@123
PAYMENT_PROVIDER=mock
SMS_PROVIDER=console
EMAIL_PROVIDER=none

# ---- Your owner login (full access; never shown on the site) ----
SEED_OWNER_EMAIL=${OWNER_EMAIL}
SEED_OWNER_PASSWORD='${OWNER_PASSWORD}'

# ---- Push notifications (generated below) ----
VAPID_SUBJECT=mailto:${OWNER_EMAIL}
ENV
  chmod 600 .env
else
  say "Keeping the existing .env"
fi
set -a
# .env is generated above.
# shellcheck disable=SC1091
. ./.env
set +a
SHARED=false
[ -z "${COMPOSE_PROFILES:-}" ] && SHARED=true
APP_PORT=${APP_PORT:-3005}

# ---------------------------------------------------------------- Firewall (dedicated only)
if [ "$SHARED" = false ] && command -v ufw >/dev/null 2>&1; then
  say "Opening SSH, HTTP and HTTPS in the firewall"
  ufw allow OpenSSH >/dev/null
  ufw allow 80/tcp >/dev/null
  ufw allow 443/tcp >/dev/null
  ufw allow 443/udp >/dev/null
  ufw --force enable >/dev/null
fi

# ---------------------------------------------------------------- DNS check
server_ip=$(curl -fsS -4 https://ifconfig.me 2>/dev/null || true)
domain_ip=$(getent ahostsv4 "$DOMAIN" 2>/dev/null | awk 'NR==1 { print $1 }')
DNS_OK=true
if [ -n "$server_ip" ] && [ "$domain_ip" != "$server_ip" ]; then
  DNS_OK=false
  warn "Warning: ${DOMAIN} points to \"${domain_ip:-nothing}\", but this server is ${server_ip}."
  echo "Add an A record for ${DOMAIN} -> ${server_ip} (docs/hostinger.md, step 2); HTTPS needs it."
fi

# ---------------------------------------------------------------- Build
say "Building the images (5-10 minutes the first time)"
"${COMPOSE[@]}" build

if ! grep -q '^VAPID_PUBLIC_KEY=.\+' .env; then
  say "Generating push notification keys"
  keys=$("${COMPOSE[@]}" run --rm --no-deps -T migrate pnpm -s exec web-push generate-vapid-keys --json)
  python3 - "$keys" >> .env <<'PY'
import json, sys
k = json.loads(sys.argv[1])
print(f"VAPID_PUBLIC_KEY={k['publicKey']}\nVAPID_PRIVATE_KEY={k['privateKey']}")
PY
fi

# ---------------------------------------------------------------- Start
say "Starting the store"
"${COMPOSE[@]}" up -d --remove-orphans
status=""
for _ in $(seq 1 60); do
  status=$("${COMPOSE[@]}" ps app --format '{{.Health}}' 2>/dev/null || true)
  [ "$status" = "healthy" ] && break
  sleep 3
done
[ "$status" = "healthy" ] || die "the app did not become healthy: ${COMPOSE[*]} logs app"

# ---------------------------------------------------------------- Demo catalogue (first run)
if [ ! -f .demo-seeded ]; then
  say "Loading the demo catalogue"
  "${COMPOSE[@]}" run --rm -T migrate pnpm -s db:seed
  "${COMPOSE[@]}" exec -T scheduler refresh-cache.sh || true
  touch .demo-seeded
fi

# ---------------------------------------------------------------- Shared server: web server site
if [ "$SHARED" = true ]; then
  if systemctl is-active --quiet nginx; then
    site=/etc/nginx/sites-available/${DOMAIN}
    if [ ! -f "$site" ]; then
      say "Adding the Nginx site for ${DOMAIN}"
      cat > "$site" <<NGINX
# Neo Store (docker-compose.prod.yml, app on 127.0.0.1:${APP_PORT}). Written by hostinger-setup.sh.
server {
    listen 80;
    listen [::]:80;
    server_name ${DOMAIN};
    client_max_body_size 10m;

    location / {
        proxy_pass http://127.0.0.1:${APP_PORT};
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        # The app trusts X-Real-IP for rate limits: always overwrite it here.
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_set_header X-Forwarded-Host \$host;
        proxy_read_timeout 120s;
    }
}
NGINX
      ln -sf "$site" "/etc/nginx/sites-enabled/${DOMAIN}"
      nginx -t && systemctl reload nginx
      NEW_SITE=true
    else
      say "Keeping the existing Nginx site ${site} (not changed)"
      grep -q "127.0.0.1:${APP_PORT}" "$site" \
        || warn "Note: ${site} doesn't mention 127.0.0.1:${APP_PORT}; make sure it forwards there."
      NEW_SITE=false
    fi
    if [ "$NEW_SITE" = false ]; then
      : # An existing site already has its HTTPS setup; leave it alone.
    elif [ "$DNS_OK" = true ]; then
      if command -v certbot >/dev/null 2>&1; then
        say "Getting the HTTPS certificate"
        certbot --nginx -d "$DOMAIN" --non-interactive --agree-tos -m "$ACME_EMAIL" --redirect \
          || warn "certbot failed; run it again later: sudo certbot --nginx -d ${DOMAIN}"
      else
        warn "certbot is not installed. Install it and get the certificate with:"
        echo "  sudo apt install -y certbot python3-certbot-nginx"
        echo "  sudo certbot --nginx -d ${DOMAIN} --redirect"
      fi
    else
      warn "Get the certificate once DNS points here: sudo certbot --nginx -d ${DOMAIN} --redirect"
    fi
  else
    warn "Another web server (not Nginx) uses ports 80/443. Point ${DOMAIN} at the store in it:"
    echo "  forward to http://127.0.0.1:${APP_PORT}"
    echo "  set the headers Host, X-Forwarded-Proto and X-Real-IP (the visitor's IP, overwritten)"
    echo "  and enable HTTPS for ${DOMAIN} there."
  fi
fi

cat <<DONE

$(printf '\033[1;32m')Neo Store is running.$(printf '\033[0m')

  Store:        https://${DOMAIN}
  Admin:        https://${DOMAIN}/en/admin/login
  Your login:   ${SEED_OWNER_EMAIL} (full access)
  Demo admin:   ${DEMO_ADMIN_EMAIL} / ${DEMO_ADMIN_PASSWORD} (view only, shown on the login page)
  Customers:    any mobile number with code 123456

Update later:  sudo bash scripts/hostinger-update.sh
Logs:          ${COMPOSE[*]} logs -f app
DONE
