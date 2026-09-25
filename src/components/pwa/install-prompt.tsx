"use client";

import { Download, Share, SquarePlus, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { isIos, isStandalone, safeLocal } from "@/lib/pwa/client";

type InstallEvent = Event & {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

const DISMISSED_KEY = "pwa-install-dismissed";
const VISITS_KEY = "pwa-visits";
const SNOOZE_MS = 30 * 24 * 60 * 60_000;

/**
 * "Install the app" banner. Shown from the second visit on, never while already installed,
 * and not again for 30 days after "Not now". Android/Chrome use the browser's own install
 * dialog; iOS Safari has none, so we show the Share → Add to Home Screen steps.
 */
export function InstallPrompt({ storeName }: { storeName: string }) {
  const t = useTranslations("Pwa");
  const [mode, setMode] = useState<"prompt" | "ios" | null>(null);
  const [deferred, setDeferred] = useState<InstallEvent | null>(null);

  useEffect(() => {
    if (isStandalone()) return;
    if (Number(safeLocal.get(DISMISSED_KEY) ?? 0) > Date.now() - SNOOZE_MS) return;
    const visits = Number(safeLocal.get(VISITS_KEY) ?? 0) + 1;
    safeLocal.set(VISITS_KEY, String(visits));
    const engaged = visits >= 2;

    const onPrompt = (event: Event) => {
      event.preventDefault(); // we show our own banner instead of the mini-infobar
      setDeferred(event as InstallEvent);
      if (engaged) setMode("prompt");
    };
    const onInstalled = () => setMode(null);
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    const safari =
      /safari/i.test(navigator.userAgent) && !/crios|fxios|edgios/i.test(navigator.userAgent);
    let timer: ReturnType<typeof setTimeout> | undefined;
    if (engaged && isIos() && safari) timer = setTimeout(() => setMode("ios"), 0);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (!mode) return null;

  const dismiss = () => {
    safeLocal.set(DISMISSED_KEY, String(Date.now()));
    setMode(null);
  };
  const install = async () => {
    if (!deferred) return;
    await deferred.prompt();
    const { outcome } = await deferred.userChoice;
    setDeferred(null);
    if (outcome === "accepted") setMode(null);
    else dismiss();
  };

  return (
    <section
      aria-labelledby="install-title"
      className="fixed inset-x-3 bottom-3 z-40 mx-auto max-w-md rounded-xl border bg-background p-4 shadow-lg sm:inset-x-auto sm:right-4"
    >
      <div className="flex items-start gap-3">
        <Download className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden />
        <div className="grid flex-1 gap-2 text-sm">
          <h2 id="install-title" className="font-semibold">
            {t("installTitle", { store: storeName })}
          </h2>
          <p className="text-muted-foreground">{t("installBody")}</p>
          {mode === "ios" ? (
            <ol className="grid gap-1">
              <li className="flex items-center gap-2">
                <Share className="size-4" aria-hidden /> {t("iosStep1")}
              </li>
              <li className="flex items-center gap-2">
                <SquarePlus className="size-4" aria-hidden /> {t("iosStep2")}
              </li>
            </ol>
          ) : (
            <div className="flex gap-2">
              <Button size="sm" onClick={install}>
                {t("install")}
              </Button>
              <Button size="sm" variant="ghost" onClick={dismiss}>
                {t("notNow")}
              </Button>
            </div>
          )}
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="-mt-1 -mr-1 size-8"
          onClick={dismiss}
          aria-label={t("close")}
        >
          <X className="size-4" aria-hidden />
        </Button>
      </div>
    </section>
  );
}
