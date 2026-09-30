"use client";

import { useEffect } from "react";
import { GLOBAL_ERROR_MESSAGES } from "@/i18n/global-error-messages";

type Locale = keyof typeof GLOBAL_ERROR_MESSAGES;

/** Last-resort boundary: replaces the whole document when the root layout fails. */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    if (!process.env.NEXT_PUBLIC_SENTRY_DSN) return;
    void import("@sentry/nextjs").then((S) => S.captureException(error)).catch(() => {});
  }, [error]);

  const segment =
    typeof window === "undefined" ? "en" : (window.location.pathname.split("/")[1] ?? "en");
  const locale: Locale = segment in GLOBAL_ERROR_MESSAGES ? (segment as Locale) : "en";
  const t = GLOBAL_ERROR_MESSAGES[locale];

  return (
    <html lang={locale}>
      <body
        style={{
          fontFamily: "system-ui, sans-serif",
          display: "grid",
          placeItems: "center",
          minHeight: "100vh",
          margin: 0,
          padding: 16,
          textAlign: "center",
          background: "#fff",
          color: "#111827",
        }}
      >
        <main role="alert">
          <h1 style={{ fontSize: 24, margin: 0 }}>{t.title}</h1>
          <p style={{ color: "#4b5563", maxWidth: 420 }}>{t.description}</p>
          <button
            type="button"
            onClick={reset}
            style={{
              marginTop: 16,
              padding: "10px 20px",
              borderRadius: 8,
              border: 0,
              background: "#111827",
              color: "#fff",
              fontSize: 16,
              cursor: "pointer",
            }}
          >
            {t.retry}
          </button>
          {error.digest ? (
            <p style={{ marginTop: 24, fontSize: 12, color: "#6b7280" }}>{error.digest}</p>
          ) : null}
        </main>
      </body>
    </html>
  );
}
