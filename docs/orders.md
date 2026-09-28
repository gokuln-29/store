# Orders, fulfilment and notifications

| Concern                                | Where                                                     |
| -------------------------------------- | --------------------------------------------------------- |
| Status rules (pure, unit-tested)       | `src/lib/services/order-status.ts`                        |
| Status changes and their side effects  | `src/lib/services/order.service.ts`                       |
| Invoice and packing slip data and PDFs | `src/lib/invoice/`, `src/lib/services/invoice.service.ts` |
| Notification outbox and delivery       | `src/lib/services/notification.service.ts`                |
| Message templates (en/ta/kn)           | `Notifications` namespace in `src/messages/*.json`        |
| Email, SMS and WhatsApp adapters       | `src/lib/providers/notify/`                               |
| Admin                                  | `/admin/orders`, `/admin/orders/[id]`                     |
| Customer                               | `/account/orders`, `/account/orders/[orderNumber]`        |

## Order statuses

```
PENDING_PAYMENT ─(paid)→ PLACED → CONFIRMED → PACKED → SHIPPED → DELIVERED → RETURNED
      └─(expired)→ CANCELLED ←────┴──────────┴─────────┘   └→ RETURNED (return to origin)
```

| From                | Staff can move it to                   | Customer can         |
| ------------------- | -------------------------------------- | -------------------- |
| Pending payment     | nothing: payment or expiry moves it    | pay or let it expire |
| Placed              | Confirmed, Cancelled                   | cancel               |
| Confirmed           | Packed, Cancelled                      | cancel               |
| Packed              | Shipped, Cancelled                     | —                    |
| Shipped             | Delivered, Returned (return to origin) | —                    |
| Delivered           | Returned                               | —                    |
| Cancelled, Returned | final                                  | —                    |

Every change runs in one database transaction that locks the order row. The page sends the
status it was showing, so if two people click at the same time, only the first change applies;
the other person sees "This order was just changed by someone else" and a refreshed page.

What each change does:

- **Shipped:** saves the courier name, tracking number and tracking link (all optional; they
  can be corrected later), assigns the GST invoice number, and notifies the customer.
- **Delivered:** cash on delivery is recorded as collected (payment → Paid), and the customer
  is notified.
- **Cancelled:** all items go back into stock, the coupon use is released, and the COD payment
  is closed. A **paid online order is refunded in full automatically**. Staff therefore need the
  `payments:refund` permission (Owner) to cancel a paid order; customers can cancel their own
  paid order until it is packed. The customer is notified, with a line about the refund.
- **Returned:** items go back into stock unless staff untick "Put the items back into stock"
  (damaged goods). Refunds for returns are **not** automatic: issue them from the payment page,
  full or partial.

Staff can add **internal notes** to the timeline. Customers never see them; their timeline only
shows status changes.

## GST invoices

- The invoice number is assigned **when the order ships**, so orders cancelled before shipping
  never use a number and the series has no gaps. Format: prefix + financial year + running
  number, e.g. `DS2627-0001`. The prefix is the order number prefix (Store Settings → General).
  The number restarts every financial year (1 April, IST). GST allows at most 16 characters.
- Invoice numbers come from the `InvoiceCounter` table, one row per financial year, incremented
  inside the shipping transaction. If shipping fails, the number is released again.
- Contents: seller legal name, address, GSTIN and state; invoice and order numbers and dates;
  place of supply with its GST state code; the customer's address; per line HSN, quantity,
  rate, discount, taxable value, GST rate and CGST+SGST (same state) or IGST (other state);
  shipping (SAC 996812) and the COD fee as taxed lines; totals; amount in words; payment; reverse
  charge "No". Stores without a GSTIN get an "INVOICE" instead of a "TAX INVOICE".
- All figures come from the order as it was charged, so the invoice always matches the
  customer's payment exactly. This is tested on hundreds of random orders.
- **Language:** invoices and packing slips are in English, using each product's English name.
  The built-in PDF fonts only cover Latin characters, so Tamil or Kannada text typed into an
  address shows as `?`. Customer screens and messages are fully translated.
- Downloads:
  - Invoice: `GET /api/orders/<order number>/invoice`, for the order's customer or any staff.
  - Packing slip: `GET /api/admin/orders/<order number>/packing-slip`, staff only. It shows no
    prices, but does show a "collect Rs. X" line for COD orders.

## Customer notifications

| Event                                             | Template          |
| ------------------------------------------------- | ----------------- |
| Order placed (COD immediately, online once paid)  | `order_placed`    |
| Shipped (with courier and tracking link)          | `order_shipped`   |
| Delivered                                         | `order_delivered` |
| Cancelled (mentions the refund when there is one) | `order_cancelled` |
| Returned                                          | `order_returned`  |

Confirmed and packed are internal steps and send nothing. Messages use the language the customer
ordered in.

**Channels**

- **Email** (when the customer gave an address): Resend over its REST API. Set
  `RESEND_API_KEY` and `EMAIL_FROM`, using a sender on a domain verified in Resend. Without a
  key, development prints emails to the server log, and production sends none.
- **SMS:** the `SMS_PROVIDER` adapter, the same one used for login OTPs (MSG91 in production,
  see [sms.md](sms.md)). Indian SMS needs DLT-registered templates, so adapters receive the
  template key and parameters, not free text. Set `SMS_ORDER_UPDATES=false` to send order
  updates without SMS.
- **WhatsApp:** `WHATSAPP_PROVIDER=console` in development. A real adapter (Gupshup, Interakt,
  Meta Cloud API, …) plugs into `src/lib/providers/notify/`.

**Delivery (outbox)**

1. Notification rows are written in the same transaction as the status change, so a message is
   never lost and never announces a change that didn't happen.
2. They are sent right after the response, so an order update never waits for the email service.
3. A failed send is retried after 1, 5, 15 and 60 minutes, and after 5 attempts it is marked
   `FAILED` with the error. Each row is claimed before sending, so overlapping runs never send a
   message twice.

Retries need the cron endpoint, scheduled every 5 minutes like the order expiry job:

```bash
curl -fsS -H "Authorization: Bearer $CRON_SECRET" https://<your-domain>/api/cron/send-notifications
# {"sent":0,"failed":0,"retrying":0}
```

To check deliveries, look at the `Notification` table (`pnpm prisma studio`): status, attempts,
last error.

## Customer account

- **My account → Orders:** paginated order history.
- **Order page:**
  - progress (placed → delivered, with dates), tracking and a link to the courier's page
  - cancel (with an optional reason; paid orders are refunded)
  - **Buy again**: adds the items that are still available to the cart at today's prices
  - invoice download once shipped
