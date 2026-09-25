# Translation review (Tamil and Kannada)

All Tamil (ta) and Kannada (kn) text in `src/messages/*.json` was written during development, not by a native
speaker. It aims for natural, everyday language, using English loanwords where shoppers commonly
use them (cart, order, checkout, coupon, delivery). Please have a native speaker check at least
the keys below; everything else can be reviewed in the running app with the language switcher.

How to change a translation: edit the value in `src/messages/ta.json` or `kn.json`, keeping every
`{placeholder}` and the `{count, plural, …}` structure, then run `pnpm i18n:check`.

Invoices and packing slips are English-only by design (see [orders.md](orders.md)).

## Words I'm unsure about

| Key                                          | English                                               | Tamil                                                          | Kannada                                                  | Note                                                                                        |
| -------------------------------------------- | ----------------------------------------------------- | -------------------------------------------------------------- | -------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| `Common.breadcrumb`                          | Breadcrumb                                            | வழிச்சுவடு                                                     | ದಾರಿಸೂಚಿ                                                 | Screen-reader label only. "வழிச்சுவடு" / "ದಾರಿಸೂಚಿ" are literal; a loanword may be clearer. |
| `Errors.invalid`                             | This value isn't valid.                               | இந்த மதிப்பு சரியானதல்ல.                                       | ಈ ಮೌಲ್ಯ ಸರಿಯಾಗಿಲ್ಲ.                                      | Generic validation message.                                                                 |
| `Pwa.installTitle`                           | Install the {store} app                               | {store} செயலியை நிறுவவும்                                      | {store} ಆ್ಯಪ್ ಇನ್‌ಸ್ಟಾಲ್ ಮಾಡಿ                            | "Install" rendered as a loanword in Kannada; is a native verb better?                       |
| `Pwa.iosStep2`                               | Choose “Add to Home Screen”                           | “Add to Home Screen” என்பதைத் தேர்ந்தெடுக்கவும்                | “Add to Home Screen” ಆಯ್ಕೆಮಾಡಿ                           | The iPhone menu item stays in English because iOS may show it in English.                   |
| `PushCampaigns.title`                        | Push campaigns                                        | புஷ் பிரச்சாரங்கள்                                             | ಪುಶ್ ಅಭಿಯಾನಗಳು                                           | "Push" kept as a loanword.                                                                  |
| `Payments.statuses.AUTHORIZED`               | Authorized                                            | அங்கீகரிக்கப்பட்டது                                            | ಅಧಿಕೃತಗೊಂಡಿದೆ                                            | Payment jargon.                                                                             |
| `OrderTimeline.notes.late_payment_refunding` | Payment arrived after the order expired; refunding it | ஆர்டர் காலாவதியான பிறகு பணம் வந்தது; திருப்பி அளிக்கப்படுகிறது | ಆರ್ಡರ್ ಅವಧಿ ಮುಗಿದ ನಂತರ ಪಾವತಿ ಬಂದಿದೆ; ಮರುಪಾವತಿಸಲಾಗುತ್ತಿದೆ | Admin-only, but long.                                                                       |

## Loanwords vs native words (consistency)

| Key                     | English                                              | Tamil                                                                            | Kannada                                                      | Note                                        |
| ----------------------- | ---------------------------------------------------- | -------------------------------------------------------------------------------- | ------------------------------------------------------------ | ------------------------------------------- |
| `Header.cart`           | Cart                                                 | கூடை                                                                             | ಕಾರ್ಟ್                                                       | Loanword (கார்ட் / ಕಾರ್ಟ್) used throughout. |
| `Checkout.title`        | Checkout                                             | ஆர்டர் செய்தல்                                                                   | ಚೆಕ್‌ಔಟ್                                                     | Loanword used throughout.                   |
| `Order.number`          | Order {number}                                       | ஆர்டர் {number}                                                                  | ಆರ್ಡರ್ {number}                                              | "ஆர்டர்" / "ಆರ್ಡರ್" used throughout.        |
| `Order.methodCOD`       | Cash on delivery                                     | டெலிவரியின் போது பணம்                                                            | ಡೆಲಿವರಿ ವೇಳೆ ಹಣ ಪಾವತಿ                                        | "Cash on delivery" phrased natively.        |
| `Coupon.min_cart_value` | Add items worth {amount} or more to use this coupon. | இந்தக் கூப்பனைப் பயன்படுத்த {amount} அல்லது அதற்கு மேல் பொருட்களைச் சேர்க்கவும். | ಈ ಕೂಪನ್ ಬಳಸಲು {amount} ಅಥವಾ ಹೆಚ್ಚಿನ ಮೌಲ್ಯದ ಐಟಂಗಳನ್ನು ಸೇರಿಸಿ. |                                             |

## Notifications (email / SMS / push): customers see these outside the site

| Key                                  | English                                                                                                               | Tamil                                                                                                                        | Kannada                                                                                                                     | Note |
| ------------------------------------ | --------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- | ---- |
| `Notifications.greeting`             | Hi {name},                                                                                                            | வணக்கம் {name},                                                                                                              | ನಮಸ್ಕಾರ {name},                                                                                                             |      |
| `Notifications.order_placed.subject` | Order {number} placed                                                                                                 | ஆர்டர் {number} பதிவுசெய்யப்பட்டது                                                                                           | ಆರ್ಡರ್ {number} ದಾಖಲಾಗಿದೆ                                                                                                   |      |
| `Notifications.order_placed.body`    | Thank you for shopping with {store}! We've received your order {number} of {total}. We'll let you know when it ships. | {store} இல் வாங்கியதற்கு நன்றி! {total} மதிப்புள்ள உங்கள் ஆர்டர் {number} எங்களுக்குக் கிடைத்தது. அனுப்பியதும் தெரிவிப்போம். | {store} ನಲ್ಲಿ ಖರೀದಿಸಿದ್ದಕ್ಕೆ ಧನ್ಯವಾದಗಳು! {total} ಮೊತ್ತದ ನಿಮ್ಮ ಆರ್ಡರ್ {number} ನಮಗೆ ತಲುಪಿದೆ. ಕಳುಹಿಸಿದಾಗ ತಿಳಿಸುತ್ತೇವೆ.        |      |
| `Notifications.order_placed.sms`     | {store}: Your order {number} of {total} is placed. Thank you!                                                         | {store}: {total} மதிப்புள்ள உங்கள் ஆர்டர் {number} பதிவுசெய்யப்பட்டது. நன்றி!                                                | {store}: {total} ಮೊತ್ತದ ನಿಮ್ಮ ಆರ್ಡರ್ {number} ದಾಖಲಾಗಿದೆ. ಧನ್ಯವಾದಗಳು!                                                        |      |
| `Notifications.order_shipped.body`   | Good news! Your order {number} is on its way.                                                                         | நல்ல செய்தி! உங்கள் ஆர்டர் {number} உங்களை நோக்கி வருகிறது.                                                                  | ಶುಭ ಸುದ್ದಿ! ನಿಮ್ಮ ಆರ್ಡರ್ {number} ನಿಮ್ಮತ್ತ ಬರುತ್ತಿದೆ.                                                                       |      |
| `Notifications.order_delivered.body` | Your order {number} has been delivered. We hope you love it!                                                          | உங்கள் ஆர்டர் {number} டெலிவரி செய்யப்பட்டது. உங்களுக்குப் பிடிக்கும் என நம்புகிறோம்!                                        | ನಿಮ್ಮ ಆರ್ಡರ್ {number} ತಲುಪಿಸಲಾಗಿದೆ. ನಿಮಗೆ ಇಷ್ಟವಾಗುತ್ತದೆ ಎಂದು ಆಶಿಸುತ್ತೇವೆ!                                                   |      |
| `Notifications.order_cancelled.body` | Your order {number} has been cancelled.                                                                               | உங்கள் ஆர்டர் {number} ரத்துசெய்யப்பட்டது.                                                                                   | ನಿಮ್ಮ ಆರ್ಡರ್ {number} ರದ್ದಾಗಿದೆ.                                                                                            |      |
| `Notifications.order_returned.body`  | We've received the return of your order {number}. If a refund is due, we'll process it shortly.                       | உங்கள் ஆர்டர் {number} எங்களுக்குத் திரும்பக் கிடைத்தது. பணம் திருப்பி அளிக்க வேண்டியிருந்தால் விரைவில் செய்வோம்.            | ನಿಮ್ಮ ಆರ್ಡರ್ {number} ನಮಗೆ ಹಿಂತಿರುಗಿ ಬಂದಿದೆ. ಮರುಪಾವತಿ ಬಾಕಿಯಿದ್ದರೆ ಶೀಘ್ರದಲ್ಲೇ ಪ್ರಕ್ರಿಯೆಗೊಳಿಸುತ್ತೇವೆ.                         |      |
| `Notifications.refundLine`           | Your payment is being refunded to your original payment method. Banks usually take 5–7 working days.                  | உங்கள் பணம் நீங்கள் செலுத்திய முறைக்கே திருப்பி அளிக்கப்படுகிறது. வங்கிகள் பொதுவாக 5–7 வேலை நாட்கள் எடுக்கும்.               | ನಿಮ್ಮ ಹಣವನ್ನು ನಿಮ್ಮ ಮೂಲ ಪಾವತಿ ವಿಧಾನಕ್ಕೆ ಮರುಪಾವತಿಸಲಾಗುತ್ತಿದೆ. ಬ್ಯಾಂಕ್‌ಗಳು ಸಾಮಾನ್ಯವಾಗಿ 5–7 ಕೆಲಸದ ದಿನಗಳನ್ನು ತೆಗೆದುಕೊಳ್ಳುತ್ತವೆ. |      |
| `Notifications.trackingLine`         | Courier: {courier}. Tracking number: {tracking}.                                                                      | கூரியர்: {courier}. டிராக்கிங் எண்: {tracking}.                                                                              | ಕೊರಿಯರ್: {courier}. ಟ್ರ್ಯಾಕಿಂಗ್ ಸಂಖ್ಯೆ: {tracking}.                                                                         |      |
| `Notifications.footer`               | You're receiving this because you ordered from {store}.                                                               | நீங்கள் {store} இல் ஆர்டர் செய்ததால் இந்தச் செய்தியைப் பெறுகிறீர்கள்.                                                        | ನೀವು {store} ನಲ್ಲಿ ಆರ್ಡರ್ ಮಾಡಿದ್ದರಿಂದ ಈ ಸಂದೇಶವನ್ನು ಪಡೆಯುತ್ತಿದ್ದೀರಿ.                                                         |      |

## Order statuses (shown everywhere)

| Key                           | English          | Tamil                            | Kannada              | Note |
| ----------------------------- | ---------------- | -------------------------------- | -------------------- | ---- |
| `Order.statusPENDING_PAYMENT` | Awaiting payment | கட்டணத்திற்காகக் காத்திருக்கிறது | ಪಾವತಿಗಾಗಿ ಕಾಯುತ್ತಿದೆ |      |
| `Order.statusPLACED`          | Placed           | பதிவானது                         | ದಾಖಲಾಗಿದೆ            |      |
| `Order.statusCONFIRMED`       | Confirmed        | உறுதிசெய்யப்பட்டது               | ದೃಢೀಕರಿಸಲಾಗಿದೆ       |      |
| `Order.statusPACKED`          | Packed           | பேக் செய்யப்பட்டது               | ಪ್ಯಾಕ್ ಮಾಡಲಾಗಿದೆ     |      |
| `Order.statusSHIPPED`         | Shipped          | அனுப்பப்பட்டது                   | ರವಾನಿಸಲಾಗಿದೆ         |      |
| `Order.statusDELIVERED`       | Delivered        | டெலிவரி செய்யப்பட்டது            | ತಲುಪಿಸಲಾಗಿದೆ         |      |
| `Order.statusCANCELLED`       | Cancelled        | ரத்து செய்யப்பட்டது              | ರದ್ದಾಗಿದೆ            |      |
| `Order.statusRETURNED`        | Returned         | திருப்பி அனுப்பப்பட்டது          | ಹಿಂತಿರುಗಿಸಲಾಗಿದೆ     |      |

## Money, refunds and cancellation (must be exact)

| Key                          | English                                                                                                                                         | Tamil                                                                                                                                        | Kannada                                                                                                                | Note |
| ---------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- | ---- |
| `MyOrders.cancelRefund`      | Your payment of {amount} will be refunded to your original payment method. This can't be undone.                                                | நீங்கள் செலுத்திய {amount} உங்கள் பணம் செலுத்தும் முறைக்கே திருப்பி அளிக்கப்படும். இதைத் திரும்பப் பெற முடியாது.                             | ನೀವು ಪಾವತಿಸಿದ {amount} ನಿಮ್ಮ ಮೂಲ ಪಾವತಿ ವಿಧಾನಕ್ಕೆ ಮರುಪಾವತಿಯಾಗುತ್ತದೆ. ಇದನ್ನು ರದ್ದುಗೊಳಿಸಲು ಸಾಧ್ಯವಿಲ್ಲ.                    |      |
| `MyOrders.cancelDescription` | You can cancel until the order is packed. This can't be undone.                                                                                 | ஆர்டர் பேக் செய்யப்படும் வரை ரத்துசெய்யலாம். இதைத் திரும்பப் பெற முடியாது.                                                                   | ಆರ್ಡರ್ ಪ್ಯಾಕ್ ಆಗುವವರೆಗೆ ರದ್ದುಗೊಳಿಸಬಹುದು. ಇದನ್ನು ರದ್ದುಗೊಳಿಸಲು ಸಾಧ್ಯವಿಲ್ಲ.                                               |      |
| `Order.lateRefundHint`       | The payment arrived after the payment window closed, so this order was cancelled. The amount is being refunded to your original payment method. | பணம் செலுத்தும் நேரம் முடிந்த பிறகு பணம் வந்ததால் இந்த ஆர்டர் ரத்துசெய்யப்பட்டது. தொகை நீங்கள் செலுத்திய முறைக்கே திருப்பி அளிக்கப்படுகிறது. | ಪಾವತಿ ಸಮಯ ಮುಗಿದ ನಂತರ ಹಣ ಬಂದ ಕಾರಣ ಈ ಆರ್ಡರ್ ರದ್ದಾಗಿದೆ. ಮೊತ್ತವನ್ನು ನಿಮ್ಮ ಮೂಲ ಪಾವತಿ ವಿಧಾನಕ್ಕೆ ಮರುಪಾವತಿಸಲಾಗುತ್ತಿದೆ.         |      |
| `Order.expiredHint`          | The payment wasn't completed in time, so this order was cancelled. You haven't been charged.                                                    | குறித்த நேரத்தில் பணம் செலுத்தப்படாததால் இந்த ஆர்டர் ரத்துசெய்யப்பட்டது. உங்களிடம் கட்டணம் வசூலிக்கப்படவில்லை.                               | ಸಮಯಕ್ಕೆ ಸರಿಯಾಗಿ ಪಾವತಿ ಪೂರ್ಣಗೊಳ್ಳದ ಕಾರಣ ಈ ಆರ್ಡರ್ ರದ್ದಾಗಿದೆ. ನಿಮಗೆ ಶುಲ್ಕ ವಿಧಿಸಲಾಗಿಲ್ಲ.                                   |      |
| `Cart.offlinePrices`         | You're offline. These prices were last checked on {time}; they are confirmed again at checkout.                                                 | நீங்கள் ஆஃப்லைனில் உள்ளீர்கள். இந்த விலைகள் கடைசியாக {time} அன்று சரிபார்க்கப்பட்டன; செக்அவுட்டில் மீண்டும் உறுதிசெய்யப்படும்.               | ನೀವು ಆಫ್‌ಲೈನ್‌ನಲ್ಲಿದ್ದೀರಿ. ಈ ಬೆಲೆಗಳನ್ನು ಕೊನೆಯದಾಗಿ {time} ರಂದು ಪರಿಶೀಲಿಸಲಾಗಿದೆ; ಚೆಕ್‌ಔಟ್‌ನಲ್ಲಿ ಮತ್ತೆ ದೃಢೀಕರಿಸಲಾಗುತ್ತದೆ.  |      |
| `Errors.order_expired`       | The payment window for this order has closed. Any amount paid will be refunded.                                                                 | இந்த ஆர்டருக்கான பணம் செலுத்தும் நேரம் முடிந்துவிட்டது. செலுத்திய தொகை திருப்பி அளிக்கப்படும்.                                               | ಈ ಆರ್ಡರ್‌ನ ಪಾವತಿ ಸಮಯ ಮುಗಿದಿದೆ. ಪಾವತಿಸಿದ ಮೊತ್ತವನ್ನು ಮರುಪಾವತಿಸಲಾಗುತ್ತದೆ.                                                 |      |
| `Errors.invalid_signature`   | We couldn't verify this payment. If money was deducted, it will be confirmed or refunded automatically.                                         | இந்தப் பணம் செலுத்துதலை உறுதிப்படுத்த முடியவில்லை. பணம் கழிக்கப்பட்டிருந்தால், அது தானாக உறுதிசெய்யப்படும் அல்லது திருப்பி அளிக்கப்படும்.    | ಈ ಪಾವತಿಯನ್ನು ಪರಿಶೀಲಿಸಲು ಸಾಧ್ಯವಾಗಲಿಲ್ಲ. ಹಣ ಕಡಿತವಾಗಿದ್ದರೆ, ಅದು ಸ್ವಯಂಚಾಲಿತವಾಗಿ ದೃಢೀಕರಿಸಲ್ಪಡುತ್ತದೆ ಅಥವಾ ಮರುಪಾವತಿಯಾಗುತ್ತದೆ. |      |

## Login and phone (OTP)

| Key                   | English                                                     | Tamil                                                             | Kannada                                          | Note |
| --------------------- | ----------------------------------------------------------- | ----------------------------------------------------------------- | ------------------------------------------------ | ---- |
| `Errors.phoneInvalid` | Enter a valid 10-digit mobile number.                       | சரியான 10 இலக்க மொபைல் எண்ணை உள்ளிடவும்.                          | ಸರಿಯಾದ 10 ಅಂಕಿಯ ಮೊಬೈಲ್ ಸಂಖ್ಯೆ ನಮೂದಿಸಿ.           |      |
| `Errors.otp_invalid`  | That code is incorrect. Please try again.                   | குறியீடு தவறு. மீண்டும் முயற்சிக்கவும்.                           | ಕೋಡ್ ತಪ್ಪಾಗಿದೆ. ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಿ.                |      |
| `Errors.otp_expired`  | This code has expired. Request a new one.                   | இந்தக் குறியீடு காலாவதியாகிவிட்டது. புதிய குறியீட்டைக் கோருங்கள். | ಈ ಕೋಡ್‌ನ ಅವಧಿ ಮುಗಿದಿದೆ. ಹೊಸ ಕೋಡ್ ಪಡೆಯಿರಿ.        |      |
| `Errors.otp_cooldown` | Please wait {seconds} seconds before requesting a new code. | புதிய குறியீட்டைக் கோர {seconds} வினாடிகள் காத்திருக்கவும்.       | ಹೊಸ ಕೋಡ್ ಪಡೆಯಲು {seconds} ಸೆಕೆಂಡುಗಳು ನಿರೀಕ್ಷಿಸಿ. |      |

## Push opt-in (consent wording)

| Key              | English                                                       | Tamil                                                               | Kannada                                              | Note                                                |
| ---------------- | ------------------------------------------------------------- | ------------------------------------------------------------------- | ---------------------------------------------------- | --------------------------------------------------- |
| `Pwa.pushTitle`  | Get order updates on this device                              | இந்தச் சாதனத்தில் ஆர்டர் புதுப்பிப்புகளைப் பெறுங்கள்                | ಈ ಸಾಧನದಲ್ಲಿ ಆರ್ಡರ್ ನವೀಕರಣಗಳನ್ನು ಪಡೆಯಿರಿ              |                                                     |
| `Pwa.pushBody`   | We'll tell you when your order ships and when it's delivered. | உங்கள் ஆர்டர் அனுப்பப்படும்போதும் டெலிவரி ஆகும்போதும் தெரிவிப்போம். | ನಿಮ್ಮ ಆರ್ಡರ್ ಕಳುಹಿಸಿದಾಗ ಮತ್ತು ತಲುಪಿದಾಗ ತಿಳಿಸುತ್ತೇವೆ. |                                                     |
| `Pwa.offersToo`  | Also send me offers and news                                  | சலுகைகளையும் செய்திகளையும் அனுப்பவும்                               | ಆಫರ್‌ಗಳು ಮತ್ತು ಸುದ್ದಿಗಳನ್ನೂ ಕಳುಹಿಸಿ                  | Marketing consent: the meaning must be unambiguous. |
| `Pwa.offersHint` | Occasional promotions. Off unless you turn it on.             | அவ்வப்போது சலுகைகள். நீங்கள் இயக்கினால் மட்டுமே.                    | ಆಗಾಗ ಪ್ರಚಾರಗಳು. ನೀವು ಆನ್ ಮಾಡಿದರೆ ಮಾತ್ರ.              |                                                     |

## Also worth a look

- **SMS templates** (`Notifications.*.sms`) must match the templates you register for DLT with
  your SMS provider, word for word.
- **Admin screens**: staff-facing and lower risk, but long labels can wrap. Check Admin → Orders and
  Settings in each language.
- **Language names** come from `LocaleSwitcher.locale` (English, தமிழ், ಕನ್ನಡ).
