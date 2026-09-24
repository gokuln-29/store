"use client";

import { Banknote, CircleX, MapPin, Truck } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { useErrorText } from "@/hooks/use-error-text";
import { checkDeliveryAction } from "@/lib/actions/store.actions";
import type { ShippingQuote } from "@/lib/services/shipping.service";
import { formatINR } from "@/lib/utils/money";

const STORAGE_KEY = "delivery-pincode";

/** Pincode check on the product page. The last pincode is remembered on this device. */
export function DeliveryCheck({ variantId, quantity }: { variantId: string; quantity: number }) {
  const t = useTranslations("Product");
  const errorText = useErrorText();
  const locale = useLocale();
  const [pincode, setPincode] = useState("");
  const [result, setResult] = useState<{ quote: ShippingQuote | null } | null>(null);
  const [error, setError] = useState<string>();
  const [isPending, startTransition] = useTransition();

  function check(code: string) {
    setError(undefined);
    startTransition(async () => {
      const res = await checkDeliveryAction({ variantId, quantity, pincode: code });
      if (res.ok) {
        setResult(res.data);
        try {
          localStorage.setItem(STORAGE_KEY, code);
        } catch {
          // Storage can be unavailable (private mode); remembering is optional.
        }
      } else {
        setResult(null);
        setError(errorText(res.fieldErrors?.pincode ?? res.error));
      }
    });
  }

  // Re-check automatically for a remembered pincode (and when the variant/quantity changes).
  // Deferred a tick: localStorage only exists in the browser, after hydration.
  useEffect(() => {
    const timer = window.setTimeout(() => {
      let saved: string | null = null;
      try {
        saved = localStorage.getItem(STORAGE_KEY);
      } catch {
        saved = null;
      }
      if (saved && /^[1-9]\d{5}$/.test(saved)) {
        setPincode(saved);
        check(saved);
      }
    }, 0);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run for new variant/quantity only
  }, [variantId, quantity]);

  const quote = result?.quote;

  return (
    <div className="grid gap-3 rounded-lg border p-4">
      <h2 className="flex items-center gap-2 text-sm font-semibold">
        <MapPin className="size-4" aria-hidden />
        {t("checkDelivery")}
      </h2>
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          check(pincode.trim());
        }}
      >
        <input
          value={pincode}
          onChange={(e) => setPincode(e.target.value.replace(/\D/g, "").slice(0, 6))}
          inputMode="numeric"
          autoComplete="postal-code"
          placeholder={t("pincode")}
          aria-label={t("pincode")}
          aria-invalid={Boolean(error)}
          aria-describedby="delivery-result"
          className="h-9 w-32 rounded-md border bg-background px-3 text-sm"
        />
        <Button
          type="submit"
          variant="outline"
          size="sm"
          className="h-9"
          disabled={isPending || pincode.length !== 6}
        >
          {t("check")}
        </Button>
      </form>
      <div id="delivery-result" aria-live="polite" className="grid gap-1.5 text-sm">
        {error ? (
          <p className="text-destructive">{error}</p>
        ) : !result ? (
          <p className="text-muted-foreground">{t("deliveryHint")}</p>
        ) : !quote ? (
          <p className="flex items-center gap-2 text-destructive">
            <CircleX className="size-4 shrink-0" aria-hidden />
            {t("notDeliverable")}
          </p>
        ) : (
          <>
            <p className="flex items-center gap-2 font-medium">
              <Truck className="size-4 shrink-0 text-emerald-700" aria-hidden />
              {quote.estimatedDaysMin != null && quote.estimatedDaysMax != null
                ? t("deliveryIn", { min: quote.estimatedDaysMin, max: quote.estimatedDaysMax })
                : t("deliveryAvailable")}
              {" · "}
              {quote.isFree
                ? t("freeShipping")
                : t("shippingCharge", { amount: formatINR(quote.charge, locale) })}
            </p>
            {!quote.isFree && quote.freeShippingThreshold != null && (
              <p className="pl-6 text-muted-foreground">
                {t("freeAbove", { amount: formatINR(quote.freeShippingThreshold, locale) })}
              </p>
            )}
            <p className="flex items-center gap-2 text-muted-foreground">
              <Banknote className="size-4 shrink-0" aria-hidden />
              {quote.codAvailable ? t("codAvailable") : t("codNotAvailable")}
            </p>
          </>
        )}
      </div>
    </div>
  );
}
