# Client onboarding: a new store in under an hour

This is the runbook for turning this template into a live store for a new client. The hands-on
part takes about an hour. A few approvals (Razorpay KYC, SMS/DLT registration) take days, so
**start them first**.

## Before the day (start 1–2 weeks ahead)

The client provides or approves:

| Item                                                                                    | Why                                            | Lead time              |
| --------------------------------------------------------------------------------------- | ---------------------------------------------- | ---------------------- |
| Domain name, and access to its DNS                                                      | Store address, HTTPS                           | Same day               |
| Razorpay account, **KYC completed**                                                     | Online payments ([payments.md](payments.md))   | 2–7 days               |
| DLT registration, sender ID and SMS templates, MSG91 account                            | Customer login codes by SMS ([sms.md](sms.md)) | 3–10 days              |
| Email domain for Resend (e.g. `orders@shop.example.in`)                                 | Order emails                                   | Same day (DNS records) |
| Business details: legal name, GSTIN, registered state, address, support phone and email | Invoices, footer, setup script                 | —                      |
| Logo (square, at least 512×512 PNG) and brand colours                                   | Branding and app icon                          | —                      |
| Product list as a spreadsheet, and product photos                                       | Catalog import                                 | Varies                 |
| Delivery charges and COD policy                                                         | Shipping rules                                 | —                      |

You arrange:

- a VPS, or a Vercel project plus a database ([deployment.md](deployment.md));
- a GitHub repository for this client;
- optionally an S3 bucket for off-server backups ([backups.md](backups.md)) and a Sentry
  project.

Keep every secret for this store in a password-manager entry named after the client.

## The hour

### 1. Create the client's repository (5 min)

```sh
git clone <template repository> kaveri-store && cd kaveri-store
git remote rename origin template          # to pull template updates later
git remote add origin git@github.com:<you>/kaveri-store.git
git push -u origin main
```

Keep the repository private. The client's own changes (if any) go here; template improvements
come in with `git pull template main`.

### 2. Configure the environment (10 min)

On the server: `cp .env.example .env` and fill it in, following
[deployment.md](deployment.md#1-get-the-code-and-configure). Generate fresh secrets for this
store; **never reuse another client's**:

```sh
openssl rand -base64 32   # AUTH_SECRET
openssl rand -hex 24      # CRON_SECRET, POSTGRES_PASSWORD
pnpm exec web-push generate-vapid-keys   # VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY
```

Settings for the start:

- If Razorpay isn't live yet, begin with `PAYMENT_PROVIDER=mock` and `ALLOW_MOCK_PAYMENTS=true`,
  or switch online payments off in the admin (step 5).
- If MSG91 isn't ready, customers can't sign in yet. Treat the store as a preview until then.

### 3. Deploy and run the setup script (10 min)

VPS:

```sh
docker compose -f docker-compose.prod.yml up -d --build
docker compose -f docker-compose.prod.yml run --rm migrate pnpm setup:store
```

Vercel: deploy, then run `pnpm setup:store` locally against the production `DATABASE_URL`.

Answer the questions with the client's details. The script creates:

- the store settings;
- the **owner** login;
- one delivery rate for all of India;
- a "New arrivals" home section.

It creates no demo data.

Then check the store:

- `https://<domain>/api/health` shows `"ok"`;
- the store opens with its name;
- `https://<domain>/<lang>/admin/login` accepts the owner login.

### 4. Branding (5 min) — Admin → Settings

- **Branding:**
  - Upload the logo; the app icons are generated from it.
  - Set the primary and secondary colours; the preview warns about poor contrast.
  - Choose heading and body fonts.
- **Contact:** support email and phone, WhatsApp number, business address (printed on invoices),
  social links.
- **General:** tagline in each language, minimum order value, order number prefix.

### 5. Money and delivery (10 min) — Admin → Settings

- **Tax:** check the GSTIN, state and default GST rate, and whether prices include GST.
  Categories can have their own rate and HSN code.
- **Payments:**
  - Online payments on or off.
  - COD: on or off, fee, minimum and maximum order.
  - How long unpaid orders hold stock.
- **Shipping:**
  - Refine the "Standard delivery" rule: flat or by weight, free-delivery threshold, delivery
    days.
  - Add rules for pincode prefixes or states where needed; the highest priority wins.
  - Check a few pincodes with the delivery check on a product page.
- **Features:** switch off anything the client doesn't want: wishlist, reviews, abandoned-cart
  reminders, and so on.

### 6. Catalog (10–15 min for a prepared spreadsheet)

1. **Categories** (Admin → Categories): create the categories. On each one, define the
   **attributes** the product type needs.
   - Examples: fabric, size and colour for clothing; weight and shelf life for food; metal and
     purity for jewellery.
   - No code changes are needed for a new product type.
2. **Products → Import:**
   - Download the empty template and fill it with one row per variant. Rows with the same
     `handle` make one product, and attribute columns are `attr:<key>`.
   - Upload the file and click **Check file**. Errors are listed by row and nothing is saved.
   - Fix the errors, then click **Import**.
3. Add photos on each product (or use Cloudinary URLs in the CSV), and set products to
   **Published**.
4. **Home page** (Admin → Home page / Banners): add a hero banner, featured categories and
   product carousels.

See the README's "Product CSV import / export" section for the column rules.

### 7. Go live (10 min)

1. **Razorpay live keys and webhook.** Follow
   [deployment.md](deployment.md#razorpay-switching-to-live-mode), then turn online payments on.
2. **SMS and email.** Set `SMS_PROVIDER=msg91` with its templates, and `RESEND_API_KEY` /
   `EMAIL_FROM`. Restart with `docker compose -f docker-compose.prod.yml up -d`.
3. **Remove the mock.** Unset `ALLOW_MOCK_PAYMENTS` and set `PAYMENT_PROVIDER=razorpay`.
4. **Real test order.** On your phone:
   - sign in with an SMS code;
   - buy a low-priced product online;
   - confirm the order email, SMS and push arrive.

   Then in the admin: confirm, pack and ship the order (tracking details), download the invoice,
   and refund the payment in Admin → Payments.

5. **Search engines.** Submit `https://<domain>/sitemap.xml` in Google Search Console.
6. **Backups.** Check that `docker compose -f docker-compose.prod.yml ps` shows the scheduler as
   healthy, and that a file exists in `backups/` (and in the S3 bucket, if configured).
7. **Security.** Run through the go-live checklist in
   [security-checklist.md](security-checklist.md#go-live-checklist).

## Handover to the client

- **Admin guide.** Send [ADMIN_GUIDE.md](ADMIN_GUIDE.md) as a PDF or shared document. It is
  written for the store owner.
- **Owner login.** Share it through a password manager or in person, never in plain email or
  chat. Ask the owner to change the password on first login (account menu → Change password).
- **Staff accounts.** Create them for the client's team (Admin → Staff).
  - **Staff** can manage products, inventory, orders, customers, the home page and push
    campaigns.
  - Only the **Owner** can do the following: see the dashboard and exports, change settings,
    manage coupons, refund payments, and manage staff.
- **Support contact.** Agree who the client calls when something breaks, and how quickly.
- **Your records.** Note the server, domain registrar, and where backups go in the client's
  password-manager entry.

## Customisation checklist (per store)

- [ ] Repository created from the template; new database; new secrets
- [ ] `pnpm setup:store` run
- [ ] Logo, colours and fonts set; app icon checked on a phone (Add to Home screen)
- [ ] Categories and attribute definitions for the product type
- [ ] Products imported from CSV, photos added, products published
- [ ] Shipping rules, GST and COD configured
- [ ] Razorpay live keys and webhook
- [ ] Email (Resend), SMS (MSG91) and optionally WhatsApp set up
- [ ] Custom domain and HTTPS
- [ ] Real test order placed end to end, then refunded
- [ ] Backups verified (local and off-server)
- [ ] Owner credentials and ADMIN_GUIDE handed over

## Updating a store later

```sh
git pull template main        # template improvements
git push                      # CI builds; with auto-deploy the server updates itself
```

- Migrations run automatically on deploy.
- Read the template's commit log for changes that need new environment variables; they are
  always listed in `.env.example`.
