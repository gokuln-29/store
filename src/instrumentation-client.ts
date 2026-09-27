/**
 * Browser error monitoring. Sentry's code is only downloaded when NEXT_PUBLIC_SENTRY_DSN is
 * set, so stores without Sentry ship no extra JavaScript.
 */
const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

if (dsn) {
  void Promise.all([import("@sentry/nextjs"), import("@/lib/sentry-scrub")]).then(
    ([Sentry, { scrubEvent }]) => {
      Sentry.init({
        dsn,
        environment: process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT ?? process.env.NODE_ENV,
        tunnel: "/monitoring",
        tracesSampleRate: 0,
        sendDefaultPii: false,
        beforeSend: scrubEvent,
      });
    },
  );
}
