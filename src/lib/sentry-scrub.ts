import type { ErrorEvent } from "@sentry/nextjs";

const PHONE = /\+?91[\s-]?[6-9]\d{4}[\s-]?\d{5}\b|\b[6-9]\d{9}\b/g;
const EMAIL = /[\w.+-]+@[\w-]+\.[\w.-]+/g;

/** Removes personal data before an error leaves the server or browser. */
export function scrubEvent(event: ErrorEvent): ErrorEvent {
  if (event.request) {
    delete event.request.cookies;
    delete event.request.data;
    if (event.request.headers) {
      for (const h of Object.keys(event.request.headers)) {
        if (/cookie|authorization|x-razorpay-signature/i.test(h)) delete event.request.headers[h];
      }
    }
  }
  if (event.user) event.user = { id: event.user.id };
  const clean = (s?: string) => s?.replace(PHONE, "[phone]").replace(EMAIL, "[email]");
  if (event.message) event.message = clean(event.message);
  for (const ex of event.exception?.values ?? []) ex.value = clean(ex.value);
  return event;
}
