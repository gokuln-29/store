"use client";

import { useTranslations } from "next-intl";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";

/** Sends the error to Sentry when it is configured (the SDK is only loaded then). */
function report(error: Error) {
  if (!process.env.NEXT_PUBLIC_SENTRY_DSN) return;
  void import("@sentry/nextjs").then((Sentry) => Sentry.captureException(error)).catch(() => {});
}

/**
 * Shown by error.tsx boundaries when a page fails to render. The digest identifies the
 * matching server log line, so customers can quote it to support.
 */
export function ErrorState({
  error,
  reset,
  homeHref = "/",
}: {
  error: Error & { digest?: string };
  reset: () => void;
  homeHref?: string;
}) {
  const t = useTranslations("ErrorPage");
  useEffect(() => report(error), [error]);

  return (
    <section
      role="alert"
      className="container mx-auto flex flex-col items-center px-4 py-24 text-center"
    >
      <h1 className="text-2xl font-bold sm:text-3xl">{t("title")}</h1>
      <p className="mt-3 max-w-md text-muted-foreground">{t("description")}</p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <Button onClick={reset}>{t("retry")}</Button>
        <Button asChild variant="outline">
          <Link href={homeHref}>{t("backHome")}</Link>
        </Button>
      </div>
      {error.digest ? (
        <p className="mt-6 text-xs text-muted-foreground">
          {t("reference", { digest: error.digest })}
        </p>
      ) : null}
    </section>
  );
}
