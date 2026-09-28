import * as Sentry from "@sentry/nextjs";
import { scrubEvent } from "@/lib/sentry-scrub";

/** Server-side error monitoring; active only when SENTRY_DSN is set. */
export async function register() {
  if (!process.env.SENTRY_DSN) return;
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.SENTRY_ENVIRONMENT ?? process.env.NODE_ENV,
    tracesSampleRate: Number(process.env.SENTRY_TRACES_SAMPLE_RATE ?? 0),
    // Collect no personal data (Sentry 11 collects much of this by default).
    dataCollection: {
      userInfo: false,
      cookies: false,
      httpHeaders: { request: { allow: ["user-agent", "referer"] }, response: false },
      httpBodies: [],
      urlQueryParams: false,
      databaseQueryData: false,
    },
    beforeSend: scrubEvent,
  });
}

export const onRequestError: typeof Sentry.captureRequestError = (...args) => {
  if (process.env.SENTRY_DSN) Sentry.captureRequestError(...args);
};
