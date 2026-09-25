# Growth and engagement features

Every feature below can be switched off in **Admin → Settings → Features**. Switches default to
on. A switched-off feature disappears from the store, the admin shows a notice, and its
background work stops.

| Switch                   | What it controls                                                                       |
| ------------------------ | -------------------------------------------------------------------------------------- |
| Wishlist                 | Heart buttons, header link, `/wishlist` page, account sync                             |
| Reviews and ratings      | Review forms, product-page reviews, stars on cards, rating in search results (JSON-LD) |
| Photos in reviews        | Photo upload in the review form                                                        |
| Recently viewed          | "Recently viewed" rows on product and home pages                                       |
| Related products         | "You may also like" and "Frequently bought together" on product pages                  |
| Coupons                  | Coupon field at checkout; the server also ignores any code sent while it's off         |
| Abandoned cart reminders | The reminder job                                                                       |
| Visit statistics         | The anonymous funnel beacon and the dashboard funnel                                   |

Code: `src/lib/features.ts` (list and defaults), `getFeatures()` on the server, `useFeatures()`
in client components.

## Wishlist

- Guests' wishlists live in the browser (`localStorage`). On first sign-in the list is merged
  into the account. After that the account is the source of truth and changes save instantly,
  so the list follows the customer to other devices.
- Up to 100 products. Hidden (draft or archived) products drop out automatically.

## Recently viewed and related products

- **Recently viewed:** the last 12 products opened, kept on the device only.
- **You may also like:** other products in the same category, featured first.
- **Frequently bought together:** products that appeared in the same orders as this one,
  counting only placed orders (not unpaid or cancelled ones), most common first.

## Reviews

- **Verified buyers only:** a customer can review a product after an order containing it is
  **delivered**, once per product. The form is on the delivered order's page, under
  My account → Orders. Each review is linked to that order item and shown as "Verified
  purchase".
- **Moderation:** new reviews are pending until approved in **Admin → Reviews**, which lists
  pending reviews first. Staff with catalog permission can approve, reject or delete.
- **Ratings:** approved ratings are totalled on the product (`ratingCount`, `ratingTotal`) inside
  the same transaction as each moderation step. Cards and the product page read the totals
  directly. The product's JSON-LD includes `aggregateRating` and up to 5 reviews.
- **Privacy:**
  - Reviewers appear as first name plus last initial.
  - Photos are re-encoded on upload (at most 1600 px, WebP), which removes all metadata,
    including GPS location from phone cameras.
  - Up to 3 photos per review, with uploads rate-limited per customer.

## Coupons

**Admin → Coupons** (Owner). Each coupon has:

- a code (uppercase, 3–20 characters) and a description in each language
- either a percentage off, with an optional maximum discount, or a fixed amount off
- an optional minimum cart value
- optional total and per-customer limits
- start and end dates (India time; the end date is inclusive)
- optional restriction to categories (sub-categories included) or products

The list and detail pages show uses, discount given and revenue from orders that used the
coupon. Unpaid and cancelled orders don't count. A coupon that has been used can only be
disabled, not deleted, so order history stays intact. Every change is written to the
activity log.

## Abandoned cart reminders

- **Who:** signed-in customers whose cart has items and hasn't changed for **3 hours**. Carts
  older than 7 days are skipped.
- **How often:** once, and at most once every 7 days per customer. Emptying the cart or placing
  the order stops it.
- **Channels:** email (if the customer gave one), WhatsApp (if a provider is configured), and
  push **only** to devices that opted in to offers. No SMS.
- **Opt-out:** each email links to My account, which has a "Cart reminders" switch.
- **Runs:** from the `/api/cron/send-notifications` cron (every 5 minutes, see
  [orders.md](orders.md)), through the same notification queue with retries. Each cart is
  claimed with an atomic update, so overlapping runs never send twice.

## Dashboard

**Admin → Dashboard** has a period switch (today, last 7 days, last 30 days). Sales figures
need the `reports:read` permission (Owner). Staff see the to-do counts and low stock only.

| Number              | Definition                                                                                                                          |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| Orders              | Orders **placed** in the period: COD at checkout, online when paid. Cancelled orders are excluded. Dated by `placedAt`, India time. |
| Revenue             | Sum of those orders' totals, including GST and shipping, before refunds                                                             |
| Average order value | Revenue ÷ orders                                                                                                                    |
| Conversion          | Sessions that ordered ÷ sessions that visited (the funnel)                                                                          |
| Change              | Versus the previous period of the same length                                                                                       |
| Funnel              | Anonymous sessions per step: visited, added to cart, started checkout, ordered                                                      |
| Top products        | By revenue from counted orders in the period                                                                                        |
| Low stock           | Active variants of published products at or below their own low-stock threshold                                                     |

Tests check each number against direct database queries (`tests/integration/dashboard.test.ts`).
Charts are hand-built SVG in one validated accent colour, in light and dark. They have hover
and arrow-key tooltips and a "Show as table" view.

### Anonymous visit statistics

The funnel uses a first-party beacon (`POST /api/analytics`):

- The only identifier is a random id per browser tab session, kept in `sessionStorage`. No
  cookies, IP addresses or accounts are stored, and each step is counted at most once per
  session per day.
- Nothing is sent when the browser signals Do Not Track or Global Privacy Control. Bots are
  ignored, and requests are rate-limited.
- Data older than about 13 months is deleted by the notifications cron.

## Customers and exports

- **Admin → Customers:**
  - The list shows everyone who signed in to shop, with their order count, **lifetime value**
    (same order rule as the dashboard) and last order.
  - You can search by name, phone or email, and sort by lifetime value, orders, last order or
    date joined.
  - The detail page shows the order history, contact details and addresses.
- **CSV exports** (dashboard buttons, Owner only, recorded in the activity log):
  - **Orders:** every order created in the chosen period, all statuses, with totals, coupon and
    invoice number.
  - **Customers:** every customer with their order count, lifetime value and last order.

  Files are UTF-8 with a byte-order mark, so Excel shows Tamil and Kannada correctly. Cells that
  start with `=`, `+`, `-` or `@` are prefixed so spreadsheets don't run them as formulas.
