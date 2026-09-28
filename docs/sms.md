# SMS (MSG91)

Customers sign in with a one-time code sent by SMS, so **a live store needs a working SMS
provider**. Order updates and cart reminders can also go by SMS.

The template ships with an adapter for **[MSG91](https://msg91.com)**
(`src/lib/providers/notify/msg91.ts`). In development, `SMS_PROVIDER=console` prints messages to
the server log instead. Production refuses to use the console provider.

## Why templates

In India, every business SMS must use a template registered on the **DLT** platform (TRAI rules)
under your sender ID. Text that doesn't match an approved template is blocked by the operators.
The app therefore sends a **template id plus variables**, never free text.

## Setup

**1. DLT registration (the store owner does this, once).**

- Register the business as a "Principal Entity" on a DLT portal, such as Jio, Airtel or Vodafone
  Idea. This takes a few days and needs the company documents.
- Register a **sender ID** (header, 6 letters, e.g. `KAVERI`).
- Register the message templates below. The approval gives each template a **DLT template id**.

**2. MSG91.**

- Create an account.
- Add the sender ID and the DLT entity id.
- Under **Templates**, add each template with its DLT template id. MSG91 then gives each one its
  own **MSG91 template id**; that is the one the app needs.
- Copy the **Auth key** (Profile → Authkey).

**3. Environment variables.**

```env
SMS_PROVIDER=msg91
MSG91_AUTH_KEY=xxxxxxxxxxxxxxxxxxxxxxxx
MSG91_TEMPLATE_OTP=65f1…                  # required: login codes
MSG91_TEMPLATE_ORDER_PLACED=65f1…         # optional, one per message
MSG91_TEMPLATE_ORDER_SHIPPED=65f1…
MSG91_TEMPLATE_ORDER_DELIVERED=65f1…
MSG91_TEMPLATE_ORDER_CANCELLED=65f1…
MSG91_TEMPLATE_ORDER_RETURNED=65f1…
MSG91_TEMPLATE_CART_REMINDER=65f1…
```

**4. Restart the app, and test.** Sign in on the store with your own mobile number. If no code
arrives, the server log shows an `"scope":"otp"` error with MSG91's reason.

## Languages

Each template id above is the English version. For a Tamil or Kannada version of a message, add
the same variable name with `_TA` or `_KN`, e.g. `MSG91_TEMPLATE_ORDER_SHIPPED_TA`. A language
without its own template uses the English one. Tamil and Kannada templates are registered as
**Unicode** on DLT.

## Templates to register

Variables are written `##name##` in MSG91. Keep the names exactly as below: the app sends values
under these names. Suggested texts (English; `{#var#}` is the DLT placeholder):

| Env variable         | Suggested DLT text                                                                          | MSG91 variables                                                  |
| -------------------- | ------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| `MSG91_TEMPLATE_OTP` | `{#var#} is your login code for {#var#}. It is valid for {#var#} minutes. Do not share it.` | `##OTP##`; set the store name and minutes as fixed text in MSG91 |
| `…_ORDER_PLACED`     | `{#var#}: Your order {#var#} of {#var#} is placed. Thank you!`                              | `##storeName##` `##orderNumber##` `##total##`                    |
| `…_ORDER_SHIPPED`    | `{#var#}: Your order {#var#} has shipped. Tracking: {#var#}`                                | `##storeName##` `##orderNumber##` `##trackingNumber##`           |
| `…_ORDER_DELIVERED`  | `{#var#}: Your order {#var#} has been delivered. Thank you!`                                | `##storeName##` `##orderNumber##`                                |
| `…_ORDER_CANCELLED`  | `{#var#}: Your order {#var#} has been cancelled.`                                           | `##storeName##` `##orderNumber##`                                |
| `…_ORDER_RETURNED`   | `{#var#}: Return received for order {#var#}.`                                               | `##storeName##` `##orderNumber##`                                |
| `…_CART_REMINDER`    | `{#var#}: You left {#var#} item(s) in your cart.`                                           | `##storeName##` `##itemCount##`                                  |

`trackingNumber` is only sent when staff entered one. Leave it out of the template if your
courier doesn't give tracking numbers.

## Behaviour

- **Login code fails to send.** The customer sees "We couldn't send the code right now. Please
  try again in a minute." The attempt still counts towards the limit of 5 codes per phone per
  hour.
- **No template for an order message.** That message is marked failed and not retried. Email,
  WhatsApp and push still go out. To send order updates without SMS at all, set
  `SMS_ORDER_UPDATES=false`; login codes still use SMS.
- **Temporary MSG91 problems** (timeouts, 5xx errors) are retried by the notification job with
  back-off. Errors about the key, the template or the number (4xx) are not retried.

## Another provider

To use another provider, implement `SmsProvider` (`sendOtp`, `sendMessage`) in
`src/lib/providers/notify/`, following `msg91.ts`, and add it to `getSmsProvider()` in
`src/lib/providers/notify/index.ts`.
