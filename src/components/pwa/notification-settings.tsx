"use client";

import { useLocale, useTranslations } from "next-intl";
import { useCallback, useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  pushPreferencesAction,
  removePushSubscriptionAction,
  savePushSubscriptionAction,
  updatePushPreferencesAction,
} from "@/lib/actions/push.actions";
import {
  currentPushSubscription,
  isIos,
  isStandalone,
  pushSupported,
  subscribeToPush,
  subscriptionJson,
  swRegistration,
} from "@/lib/pwa/client";

type Prefs = { orderUpdates: boolean; offers: boolean };
type State =
  | { kind: "loading" | "unsupported" | "ios-install" | "blocked" | "off" }
  | { kind: "on"; endpoint: string; prefs: Prefs };

/** Push notifications for this device: turn on/off, order updates and offers separately. */
export function NotificationSettings({ vapidPublicKey }: { vapidPublicKey: string | null }) {
  const t = useTranslations("Pwa");
  const locale = useLocale() as "en" | "ta" | "kn";
  const [state, setState] = useState<State>({ kind: "loading" });
  const [draft, setDraft] = useState<Prefs>({ orderUpdates: true, offers: false });
  const [isPending, startTransition] = useTransition();

  const load = useCallback(async (): Promise<State> => {
    if (!vapidPublicKey || !pushSupported()) {
      return { kind: isIos() && !isStandalone() ? "ios-install" : "unsupported" };
    }
    if (Notification.permission === "denied") return { kind: "blocked" };
    if (!(await swRegistration())) return { kind: "unsupported" };
    const sub = await currentPushSubscription();
    if (!sub) return { kind: "off" };
    const result = await pushPreferencesAction(sub.endpoint);
    let prefs = result.ok ? result.data : null;
    if (!prefs) {
      // Subscribed in the browser but unknown to the server (e.g. removed): register again.
      prefs = { orderUpdates: true, offers: false };
      await savePushSubscriptionAction({ ...subscriptionJson(sub), ...prefs, locale });
    }
    return { kind: "on", endpoint: sub.endpoint, prefs };
  }, [locale, vapidPublicKey]);

  useEffect(() => {
    let cancelled = false;
    load()
      .then((s) => !cancelled && setState(s))
      .catch(() => !cancelled && setState({ kind: "unsupported" }));
    return () => {
      cancelled = true;
    };
  }, [load]);

  const turnOn = () =>
    startTransition(async () => {
      try {
        const sub = await subscribeToPush(vapidPublicKey!);
        if (sub === "denied") return setState({ kind: "blocked" });
        if (!sub) return void toast.error(t("pushFailed"));
        const saved = await savePushSubscriptionAction({
          ...subscriptionJson(sub),
          ...draft,
          locale,
        });
        if (!saved.ok) return void toast.error(t("pushFailed"));
        setState({ kind: "on", endpoint: sub.endpoint, prefs: draft });
        toast.success(t("pushEnabled"));
      } catch {
        toast.error(t("pushFailed"));
      }
    });

  const turnOff = () =>
    startTransition(async () => {
      const sub = await currentPushSubscription();
      if (sub) {
        await removePushSubscriptionAction(sub.endpoint);
        await sub.unsubscribe().catch(() => undefined);
      }
      setState({ kind: "off" });
      toast.success(t("pushDisabled"));
    });

  const change = (key: keyof Prefs, value: boolean) => {
    if (state.kind !== "on") return;
    const prefs = { ...state.prefs, [key]: value };
    setState({ ...state, prefs });
    startTransition(async () => {
      const result = await updatePushPreferencesAction({ endpoint: state.endpoint, ...prefs });
      if (result.ok) toast.success(t("preferencesSaved"));
      else toast.error(t("pushFailed"));
    });
  };

  const toggles = (prefs: Prefs, onChange: (key: keyof Prefs, value: boolean) => void) => (
    <div className="grid gap-3">
      {(["orderUpdates", "offers"] as const).map((key) => (
        <div key={key} className="flex items-center justify-between gap-4">
          <Label htmlFor={`push-${key}`} className="grid gap-0.5 font-normal">
            <span className="font-medium">{t(`${key}Label`)}</span>
            <span className="text-xs text-muted-foreground">{t(`${key}Hint`)}</span>
          </Label>
          <Switch
            id={`push-${key}`}
            checked={prefs[key]}
            disabled={isPending}
            onCheckedChange={(v) => onChange(key, v)}
          />
        </div>
      ))}
    </div>
  );

  return (
    <section aria-labelledby="notifications-heading" className="grid gap-4 rounded-lg border p-4">
      <div className="grid gap-1">
        <h2 id="notifications-heading" className="font-semibold">
          {t("settingsTitle")}
        </h2>
        <p className="text-sm text-muted-foreground">{t("settingsHint")}</p>
      </div>
      {state.kind === "loading" && <p className="text-sm text-muted-foreground">{t("checking")}</p>}
      {state.kind === "unsupported" && (
        <p className="text-sm text-muted-foreground">{t("unsupported")}</p>
      )}
      {state.kind === "ios-install" && (
        <p className="text-sm text-muted-foreground">{t("pushIosInstall")}</p>
      )}
      {state.kind === "blocked" && <p className="text-sm text-muted-foreground">{t("blocked")}</p>}
      {state.kind === "off" && (
        <>
          {toggles(draft, (key, value) => setDraft({ ...draft, [key]: value }))}
          <div>
            <Button onClick={turnOn} disabled={isPending || (!draft.orderUpdates && !draft.offers)}>
              {t("turnOnDevice")}
            </Button>
          </div>
        </>
      )}
      {state.kind === "on" && (
        <>
          {toggles(state.prefs, change)}
          <div>
            <Button variant="outline" onClick={turnOff} disabled={isPending}>
              {t("turnOffDevice")}
            </Button>
          </div>
        </>
      )}
    </section>
  );
}
