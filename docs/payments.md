# Payments

Online payments go through **Razorpay** (UPI, cards, netbanking, wallets). **Cash on delivery**
is handled by the store itself. For development there is also a **mock** provider: a local
"test payment" page with _Pay_ and _Simulate failure_ buttons.

Code map:

| Concern                                        | Where                                     |
| ---------------------------------------------- | ----------------------------------------- |
| Provider interface, Razorpay REST client, mock | `src/lib/providers/payment/`              |
| Signature checks (checkout + webhook)          | `src/lib/providers/payment/signature.ts`  |
| Capture, failure/retry, expiry, refunds        | `src/lib/services/payment.service.ts`     |
| Webhook handling and idempotency               | `src/lib/services/webhook.service.ts`     |
| Webhook endpoint                               | `POST /api/webhooks/razorpay`             |
| Expiry job endpoint                            | `GET /api/cron/expire-orders`             |
| Admin                                          | `/admin/payments` (list, detail, refunds) |

## How an online payment works

1. **Place order.** The server prices the cart, reserves stock and creates the order as
   `PENDING_PAYMENT` with an expiry time (Store Settings → Payments → "hold time", default
   30 minutes). It then creates a Razorpay order **for the server-calculated total**.
2. **Pay.** `/checkout/pay/<order number>` opens Razorpay Checkout for that Razorpay order.
   Razorpay's window lets the customer retry failed attempts; closing it and coming back later
   (from the order page's _Complete payment_ button) reuses the same Razorpay order.
3. **Confirm.** Two independent paths, either one is enough:
   - **Browser callback:** the checkout success handler sends `razorpay_order_id`,
     `razorpay_payment_id` and `razorpay_signature`. The server verifies
     `HMAC-SHA256(order_id|payment_id, key secret)`, then **fetches the payment from Razorpay**
     (the amount and status never come from the browser) and captures it if needed.
   - **Webhook:** `payment.captured` (and `payment.failed`, `payment.authorized`) from Razorpay.
4. The order becomes `PLACED` / payment `CAPTURED`. Both paths are idempotent and lock the order
   row, so any number of callbacks and webhook deliveries in any order produce exactly one
   "payment captured" event.

### Edge cases handled

| Situation                                         | What happens                                                                                 |
| ------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| Payment fails                                     | Payment `FAILED` with the bank's reason; order stays payable until it expires.               |
| Old "failed" webhook arrives after a success      | Ignored; a failure never undoes a capture.                                                   |
| Order not paid in time                            | Expiry job cancels it, releases stock and the coupon use.                                    |
| Paid at the last second, webhook not yet received | Before expiring, the job asks Razorpay; a captured payment completes the order instead.      |
| Payment captured **after** the order expired      | Recorded, and **refunded in full automatically** (stock was already released).               |
| Customer pays twice for one order (two tabs)      | Second payment is recorded and refunded automatically.                                       |
| Same webhook delivered again                      | Stored by event id in `WebhookEvent`; replays return 200 and change nothing.                 |
| Razorpay unreachable                              | Checkout still creates the order; the pay page retries. Expiry is postponed to the next run. |

## Refunds

Admin → **Payments** → a payment → **Refund**. Only the **Owner** role can refund
(`payments:refund`); staff can view payments.

- Full or partial, any number of times, never more than the amount paid. Refunds still in
  progress count against the remaining amount, and the check runs under a row lock, so two
  admins clicking at once can't over-refund. A database `CHECK` constraint backs this up.
- Razorpay refunds usually start as _processing_. The `refund.processed` webhook marks them
  done, updates `Payment.refundedAmount` (counted exactly once) and sets the payment and order
  to `PARTIALLY_REFUNDED` or `REFUNDED`.
- Each refund carries our refund id as the Razorpay `receipt`. If the API call times out but
  Razorpay did process it, the webhook still finds and settles it.
- Refunds made directly in the Razorpay Dashboard are recorded too, from their webhook.
- Every admin refund is written to the activity log.
- COD payments are refunded outside the store (UPI or bank transfer).
- Refunding does **not** cancel the order or restock items. Cancellations and returns are part
  of order management.

## Setup (test mode)

1. Create a Razorpay account and switch the Dashboard to **Test mode**.
2. **Account & Settings → API Keys → Generate test key.** Put them in `.env`:

   ```env
   PAYMENT_PROVIDER=razorpay
   RAZORPAY_KEY_ID=rzp_test_xxxxxxxxxxxx
   RAZORPAY_KEY_SECRET=xxxxxxxxxxxxxxxxxxxxxxxx
   ```

3. Keep **automatic capture** on (Account & Settings → Payment capture); it is the default. If
   you turn it off, the app captures authorized payments itself.
4. Restart `pnpm dev` and place an online order. In test mode, Razorpay's checkout accepts the
   test UPI IDs `success@razorpay` and `failure@razorpay`, and the test cards listed at
   <https://razorpay.com/docs/payments/payments/test-card-details/>.

Without a webhook, payments are still confirmed by the browser callback. The webhook covers
customers who close the tab after paying, refund completion, and failures.

## Webhooks

Configure in **Account & Settings → Webhooks → Add new webhook**:

- **URL:** `https://<your-domain>/api/webhooks/razorpay`
- **Secret:** a long random string. Put the same value in `RAZORPAY_WEBHOOK_SECRET`.
- **Events:** `payment.captured`, `payment.failed`, `payment.authorized`, `refund.processed`,
  `refund.failed`

The endpoint verifies `X-Razorpay-Signature` (HMAC-SHA256 of the raw body) and answers:

| Status | Meaning (Razorpay retries only on 5xx/timeouts)                                        |
| ------ | -------------------------------------------------------------------------------------- |
| 200    | processed, duplicate, or an event we don't use                                         |
| 400    | body isn't a valid Razorpay event                                                      |
| 401    | signature doesn't match                                                                |
| 500    | processing failed; the error is stored on the `WebhookEvent` row, and Razorpay retries |

### Testing webhooks locally

Razorpay must reach your machine over HTTPS. Use a tunnel:

```bash
pnpm dev
# in another terminal, either:
ngrok http 3000
cloudflared tunnel --url http://localhost:3000
```

Use the printed `https://…/api/webhooks/razorpay` as the webhook URL in the **test mode**
Dashboard. Pay a test order and watch the dev server log. Every delivery is listed in the
`WebhookEvent` table (`pnpm prisma studio`), and Razorpay's webhook page shows each delivery's
response.

You can also send a signed event by hand. This is useful for replays and edge cases:

```bash
BODY='{"event":"payment.failed","payload":{"payment":{"entity":{"id":"pay_test1","order_id":"order_XXXX","amount":30900,"status":"failed","method":"upi","error_description":"Declined"}}}}'
SIG=$(printf '%s' "$BODY" | openssl dgst -sha256 -hmac "$RAZORPAY_WEBHOOK_SECRET" | cut -d' ' -f2)
curl -i http://localhost:3000/api/webhooks/razorpay \
  -H "Content-Type: application/json" -H "X-Razorpay-Signature: $SIG" \
  -H "X-Razorpay-Event-Id: evt_manual_1" --data "$BODY"
# Run the same command again: {"result":"duplicate"}, nothing changes.
```

Replace `order_XXXX` with the order's `providerOrderId` (Admin → Payments → the payment).

## Expiring unpaid orders

Unpaid online orders hold stock until they expire. The expiry job cancels them, returns stock
and coupon uses, and first double-checks Razorpay for a last-second payment. It runs:

- **on demand:** whenever a customer opens an overdue order or its payment page, and
- **on a schedule:** call the cron endpoint every 5 minutes with the secret:

```bash
curl -fsS -H "Authorization: Bearer $CRON_SECRET" https://<your-domain>/api/cron/expire-orders
# {"checked":1,"expired":1,"paid":0,"skipped":0}
```

Set `CRON_SECRET` (e.g. `openssl rand -hex 24`). The endpoint returns 503 until it is set.
Schedule `/api/cron/send-notifications` the same way; see [orders.md](orders.md).

- **VPS / Docker:** add a crontab entry on the host:
  `*/5 * * * * curl -fsS -H "Authorization: Bearer <secret>" https://<domain>/api/cron/expire-orders > /dev/null`
- **Vercel:** add to `vercel.json` (Vercel sends `Authorization: Bearer $CRON_SECRET` itself):

  ```json
  { "crons": [{ "path": "/api/cron/expire-orders", "schedule": "*/5 * * * *" }] }
  ```

  Vercel's Hobby plan only allows daily crons. Use Pro, or an external scheduler
  (cron-job.org, GitHub Actions) calling the URL with the header.

## Cash on delivery

Store Settings → Payments: enable or disable COD, an optional COD fee (taxed like shipping at
the order's highest GST rate), and optional minimum/maximum order values for COD. COD orders are
`PLACED` immediately with a `PENDING` COD payment. Marking cash as collected is part of order
fulfilment.

## Going live checklist

- [ ] Razorpay account activated (KYC done), Dashboard switched to **Live mode**
- [ ] Live keys (`rzp_live_…`) in the production environment; test keys removed
- [ ] `PAYMENT_PROVIDER=razorpay`, and `ALLOW_MOCK_PAYMENTS` unset
- [ ] Live-mode webhook created with the events above; `RAZORPAY_WEBHOOK_SECRET` matches
- [ ] `CRON_SECRET` set and the 5-minute schedule running (check its JSON output once)
- [ ] One real low-value payment made and refunded from Admin → Payments
