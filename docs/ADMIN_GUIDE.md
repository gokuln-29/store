# Running your store: a guide for owners

This guide explains the everyday work of running your online store: orders, products, offers and
settings. You don't need any technical knowledge. The admin panel works on a phone as well as on
a computer.

**Signing in.**

- Go to `https://<your-store>/en/admin/login` and sign in with the email and password you were
  given.
- Change your password the first time you sign in: open the account menu (top right), then
  **Change password**.
- Never share your login. Create a separate account for each person on your team (see
  [Your team](#your-team)).

---

## The dashboard

The first page shows how the store is doing:

- **Revenue, orders, average order value and conversion** for today, the last 7 days or the
  last 30 days, compared with the period before.
  - Online orders count once paid; cash-on-delivery orders count once placed.
  - Cancelled orders are left out.
- **Needs attention:** orders waiting to be confirmed, and reviews waiting for approval.
- **Charts** of revenue and orders over time, and your top products. Every chart can also be
  shown as a table.
- **Conversion funnel:** visits, then added to cart, started checkout and ordered. A big drop at
  one step shows where shoppers give up.
- **Low stock:** products that are running out.
- **Export orders / Export customers:** download spreadsheets (CSV) that open in Excel.

---

## Orders

**Admin → Orders** lists every order, newest first.

- **Search:** by order number, invoice number, phone or name.
- **Filters:** by status, payment, payment method, or dates.

### An order's journey

| Status                       | What it means                                                    | What you do                                                                                                                   |
| ---------------------------- | ---------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| **Awaiting payment**         | The customer chose online payment but hasn't paid yet            | Nothing. If they don't pay in time (30 minutes by default), the order cancels itself and the stock returns                    |
| **Placed**                   | A new order: paid online, or cash on delivery                    | Check it, then press **Confirm order**                                                                                        |
| **Confirmed**                | You've accepted it                                               | Pack the items. Print the **packing slip (PDF)** to help                                                                      |
| **Packed**                   | Ready to hand to the courier                                     | Press **Mark as shipped** and enter the courier, tracking number and tracking link (all optional; you can correct them later) |
| **Shipped**                  | On its way                                                       | When it arrives, press **Mark as delivered**                                                                                  |
| **Delivered**                | Done. For cash on delivery, the payment is recorded as collected | —                                                                                                                             |
| **Cancelled** / **Returned** | Closed                                                           | —                                                                                                                             |

The customer gets an email, SMS and/or app notification when the order is placed, shipped,
delivered, cancelled or returned.

### Invoices

The **GST invoice** is created automatically when you mark the order as shipped. Download it from
the order page with **Invoice (PDF)**. Customers can also download it from their account.

### Cancelling

Press **Cancel order** and give a reason. What happens next:

- The items go back into stock.
- If the customer paid online, **the full amount is refunded automatically**, so only the owner
  can cancel a paid order.
- Customers can cancel their own order themselves until it is packed.

### Returns

When a shipped or delivered order comes back, press **Mark as returned**. If the goods are
damaged and can't be sold again, untick **Put the items back into stock**.

Returns are **not** refunded automatically. Refund the customer from the payment page (see
below): the full amount, or part of it.

### Notes

Use **Add note** on an order for anything your team should know, such as "Customer asked for
gift wrap". Customers never see notes.

If two people change the same order at the same moment, only the first change is saved. The
other person sees a message and the updated order.

---

## Payments and refunds

**Admin → Payments** lists every payment: online (UPI, cards, netbanking) and cash on delivery.

**To refund** (owner only):

1. Open the payment and press **Refund…**.
2. Enter the amount; it can be less than the full payment.
3. Add a reason if you like.
4. Confirm.

The money goes back to the customer's original payment method. Banks usually take **5–7 working
days**. A refund can't be undone.

Cash-on-delivery payments can't be refunded through the store. Pay the customer back yourself,
for example by UPI or bank transfer.

---

## Products

### Categories and attributes

**Admin → Categories.** Categories organise your store, for example Sarees, Kurtas and
Dupattas. A category can sit inside another one.

Each category can have **attributes**: the details customers filter by, such as fabric, size or
colour. You set them once on the category. Every product in that category then gets those
fields, and shoppers can filter by them.

A category can also have its own **GST rate** and **HSN code**, if it differs from the store's
default.

### Adding and editing products

**Admin → Products → New product**, or open an existing one.

- **Name and description** in each language. English is required; Tamil and Kannada are shown
  when filled in, otherwise English is shown.
- **Photos:** drag to reorder; the first photo is the main one.
- **Variants:** each option combination (e.g. size M / red) has its own price, MRP (the crossed-out
  price), SKU, weight and stock.
- **Status:** products appear in the store only when **Published**. Use **Draft** while you're
  working on them.
- **Featured:** featured products can appear in the "Bestsellers" section on the home page.

### Adding many products at once

**Admin → Products → Import.**

1. Download the **empty template** (a spreadsheet).
2. Fill in one row per variant. Rows with the same _handle_ belong to one product.
3. Upload the file and press **Check file**. Mistakes are listed by row number, and nothing is
   saved yet.
4. Fix the mistakes and upload again, then press **Import**.

**Export** downloads your whole catalogue in the same format. This is handy for changing many
prices at once: export, edit in Excel, import.

### Stock

**Admin → Inventory** shows the stock of every variant.

- **Change a stock level:** type the new number and press **Enter**.
- **Filters:** "Low stock" and "Out of stock" show what needs reordering.

Stock goes down when an order is placed and comes back when an order is cancelled or returned.
Customers can't order more than you have.

---

## Home page and banners

- **Admin → Home page:** choose the sections shown on your home page and their order.
  - **Hero banner:** large pictures at the top.
  - **Featured categories.**
  - **Product carousels:** bestsellers, new arrivals, or one category.
  - **Offer strip:** a thin line of text, e.g. "Free delivery above ₹999".
  - **Testimonials** and **text** blocks.
- **Admin → Banners:** the pictures for the hero banner, each with a link and optional start and
  end dates, handy for festival sales.

Changes appear on the store straight away.

---

## Offers and marketing

### Coupons (owner only)

**Admin → Coupons → New coupon.**

- **Code:** what the customer types, e.g. `DIWALI15`.
- **Discount type:** percentage off, or a fixed amount off.
- **Minimum cart value:** optional.
- **Validity dates and total uses:** optional.
- **Scope:** limit the coupon to certain categories if you like.

Customers enter the code at checkout. The discount is always checked by the store, so it can't be
misused.

### Push campaigns

**Admin → Push campaigns** sends a notification to the phones and computers of customers who
**asked for offers and news**. Customers are never signed up without asking.

1. Write a short title and message.
2. Choose where the tap leads, e.g. a sale category.
3. Check the preview, then send.

### Abandoned cart reminders

If this feature is switched on (Settings → Features), customers who signed in and left items in
their cart get **one** reminder a few hours later. They can turn these off in their account.

### Reviews

Customers can review products they received. Reviews appear on the store only after you
**Approve** them in **Admin → Reviews**; use **Reject** for spam or offensive text. Reviews from
real buyers show a "Verified purchase" badge.

---

## Customers

**Admin → Customers** lists everyone who has signed in to shop, with the number of orders and
total spend (**lifetime value**).

- Open a customer to see their contact details and order history.
- Customers sign in with their mobile number and a one-time SMS code. They have no password to
  forget.

---

## Settings (owner only)

| Section      | What you set                                                                                                                            |
| ------------ | --------------------------------------------------------------------------------------------------------------------------------------- |
| **General**  | Store name, tagline, languages shown, default language, minimum order value, order number prefix                                        |
| **Branding** | Logo (also used as the app icon on phones), colours, fonts. The preview warns if text would be hard to read                             |
| **Contact**  | Support email and phone, WhatsApp number, business address (printed on invoices), social media links                                    |
| **Tax**      | Legal name, GSTIN, your state (decides CGST+SGST or IGST on invoices), whether your prices include GST, default GST rate                |
| **Payments** | Online payments on or off; cash on delivery on or off, with fee and minimum and maximum order; how long unpaid online orders hold stock |
| **Shipping** | Delivery charges (see below)                                                                                                            |
| **Features** | Switch optional features on or off: wishlist, reviews, cart reminders, recently viewed, related products and others                     |

### Delivery charges

Each **shipping rule** matches deliveries by **pincode start** (e.g. `560` for Bengaluru) or by
**state**, and sets:

- the charge: flat, or by parcel weight;
- a free-delivery amount;
- the delivery time in days;
- whether cash on delivery is available.

When several rules match, the one with the **highest priority** wins. Keep one rule with no
pincodes and no states as a catch-all for the rest of India.

Customers see the charge and the delivery time when they enter their pincode on a product page
or at checkout.

---

## Your team

**Admin → Staff** (owner only): add an account for each team member, with their email and a
starting password.

|                                                   | Owner | Staff |
| ------------------------------------------------- | ----- | ----- |
| Orders: confirm, pack, ship, deliver, notes       | ✔     | ✔     |
| Cancel an order that was paid online (refunds it) | ✔     | —     |
| Products, categories, inventory, import           | ✔     | ✔     |
| Home page, banners, push campaigns, reviews       | ✔     | ✔     |
| Customers                                         | ✔     | ✔     |
| Dashboard and exports                             | ✔     | —     |
| Coupons                                           | ✔     | —     |
| Refunds                                           | ✔     | —     |
| Settings and staff                                | ✔     | —     |

- When someone leaves, deactivate their account on the same page.
- **Admin → Activity log** shows who changed what and when: prices, stock, refunds and settings.

---

## Languages

The store is available in the languages chosen under **Settings → General**: English, Tamil and
Kannada. Customers switch with the language button at the top.

Buttons, emails, SMS and invoices are already translated. For **your own content** (product
names and descriptions, categories, banners, home page text), fill in each language's tab. If
you leave one empty, English is shown instead.

---

## When something goes wrong

| Problem                                               | What to do                                                                                                                              |
| ----------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| A customer paid but the order says "Awaiting payment" | Wait 5 minutes; the store checks with the bank and updates the order. If it's still stuck, contact your developer with the order number |
| A customer isn't getting the SMS code                 | Check the number. Codes can be requested again after 30 seconds, up to 5 per hour. If nobody gets codes, contact your developer         |
| A refund shows "Processing" for a long time           | Banks take up to 7 working days. After that, contact Razorpay support with the payment id shown on the payment page                     |
| You forgot your password                              | Ask another owner to reset it under Admin → Staff, or contact your developer                                                            |
| The store is down                                     | Contact your developer. Your data is backed up every night                                                                              |
