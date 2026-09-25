"use client";

import { BellRing, X } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { savePushSubscriptionAction } from "@/lib/actions/push.actions";
import {
  currentPushSubscription,
  isIos,
  isStandalone,
  pushSupported,
  safeLocal,
  subscribeToPush,
  subscriptionJson,
  swRegistration,
} from "@/lib/pwa/client";

const DISMISSED_KEY = "push-optin-dismissed";

/**
 * Offers order updates by push right after an order (a moment where they are clearly useful),
 * never on page load. Offers and news are a separate, unticked choice.
 */
export function PushOptIn({ vapidPublicKey }: { vapidPublicKey: string | null }) {
  const t = useTranslations("Pwa");
  const locale = useLocale();
  const [state, setState] = useState<"hidden" | "offer" | "ios-install">("hidden");
  const [offers, setOffers] = useState(false);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!vapidPublicKey || safeLocal.get(DISMISSED_KEY)) return;
      // iPhone/iPad only allow web push for apps added to the Home Screen.
      if (isIos() && !isStandalone()) {
        if (!cancelled) setState("ios-install");
        return;
      }
      if (!pushSupported() || Notification.permission === "denied") return;
      if (!(await swRegistration()) || (await currentPushSubscription())) return;
      if (!cancelled) setState("offer");
    })();
    return () => {
      cancelled = true;
    };
  }, [vapidPublicKey]);

  if (state === "hidden") return null;
  const dismiss = () => {
    safeLocal.set(DISMISSED_KEY, "1");
    setState("hidden");
  };

  const enable = () =>
    startTransition(async () => {
      try {
        const sub = await subscribeToPush(vapidPublicKey!);
        if (sub === "denied") {
          toast.info(t("permissionDenied"));
          return dismiss();
        }
        if (!sub) return void toast.error(t("pushFailed"));
        const result = await savePushSubscriptionAction({
          ...subscriptionJson(sub),
          orderUpdates: true,
          offers,
          locale: locale as "en" | "ta" | "kn",
        });
        if (!result.ok) return void toast.error(t("pushFailed"));
        toast.success(t("pushEnabled"));
        setState("hidden");
      } catch {
        toast.error(t("pushFailed"));
      }
    });

  return (
    <section
      aria-labelledby="push-title"
      className="grid gap-3 rounded-lg border bg-muted/40 p-4 text-left text-sm"
    >
      <div className="flex items-start gap-3">
        <BellRing className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden />
        <div className="grid flex-1 gap-1">
          <h2 id="push-title" className="font-semibold">
            {t("pushTitle")}
          </h2>
          <p className="text-muted-foreground">
            {state === "ios-install" ? t("pushIosInstall") : t("pushBody")}
          </p>
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
      {state === "offer" && (
        <>
          <div className="flex items-center gap-2">
            <Checkbox
              id="push-offers"
              checked={offers}
              onCheckedChange={(v) => setOffers(v === true)}
            />
            <Label htmlFor="push-offers" className="font-normal">
              {t("offersToo")}
            </Label>
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={enable} disabled={isPending}>
              {t("turnOn")}
            </Button>
            <Button size="sm" variant="ghost" onClick={dismiss} disabled={isPending}>
              {t("noThanks")}
            </Button>
          </div>
        </>
      )}
    </section>
  );
}
