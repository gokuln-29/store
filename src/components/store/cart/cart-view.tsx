"use client";

import { Minus, Plus, ShoppingBag, Trash2, TriangleAlert, WifiOff } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { priceCartAction, type PricedCart } from "@/lib/actions/cart.actions";
import { cartFromSnapshot, readCartSnapshot, saveCartSnapshot } from "@/lib/cart-snapshot";
import { useCart } from "@/lib/cart-store";
import { formatDateTime } from "@/lib/utils/format";
import { localize } from "@/lib/utils/localized";
import { formatINR } from "@/lib/utils/money";
import { LineSummary } from "./line-item";

const subscribe = () => () => {};

export function CartView() {
  const t = useTranslations("Cart");
  const tProduct = useTranslations("Product");
  const tErrors = useTranslations("Errors");
  const locale = useLocale();
  const hydrated = useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
  const items = useCart((s) => s.items);
  const { setQuantity, remove, replace } = useCart.getState();
  const [cart, setCart] = useState<PricedCart | null>(null);
  const [notices, setNotices] = useState<string[]>([]);
  const [failed, setFailed] = useState(false);
  /** Set when showing the last known prices because the server can't be reached. */
  const [offlineSince, setOfflineSince] = useState<number | null>(null);
  const request = useRef(0);

  // Back online: price the cart again.
  useEffect(() => {
    const retry = () => useCart.getState().replace([...useCart.getState().items]);
    window.addEventListener("online", retry);
    return () => window.removeEventListener("online", retry);
  }, []);

  // Re-price on every change; the server clamps quantities and drops unavailable items.
  useEffect(() => {
    if (!hydrated) return;
    const id = ++request.current;
    const timer = setTimeout(async () => {
      const result = await priceCartAction(items).catch(() => null);
      if (id !== request.current) return;
      if (!result?.ok) {
        const snapshot = !navigator.onLine || !result ? readCartSnapshot() : null;
        if (snapshot) {
          setCart(cartFromSnapshot(snapshot, items));
          setOfflineSince(snapshot.savedAt);
          setFailed(false);
          return;
        }
        setFailed(true);
        return;
      }
      setFailed(false);
      setOfflineSince(null);
      setCart(result.data);
      saveCartSnapshot(result.data);
      if (result.data.adjustments.length) {
        setNotices(
          result.data.adjustments.map((a) =>
            a.kind === "unavailable"
              ? t("unavailable")
              : t("quantityReduced", { available: a.available }),
          ),
        );
        replace(result.data.items);
      }
    }, 150);
    return () => clearTimeout(timer);
  }, [items, hydrated, replace, t]);

  if (failed && !cart) {
    return (
      <div role="alert" className="flex flex-col items-center gap-4 py-16 text-center">
        <p className="text-muted-foreground">{tErrors("unknown")}</p>
        <Button variant="outline" onClick={() => useCart.getState().replace([...items])}>
          {tErrors("retry")}
        </Button>
      </div>
    );
  }

  if (!hydrated || (items.length > 0 && !cart)) {
    return (
      <p className="py-16 text-center text-muted-foreground" aria-busy="true">
        {t("loading")}
      </p>
    );
  }

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center py-16 text-center">
        <ShoppingBag className="size-12 text-muted-foreground" aria-hidden />
        <p className="mt-4 text-lg font-medium">{t("empty")}</p>
        <p className="mt-1 text-muted-foreground">{t("emptyHint")}</p>
        <Button asChild className="mt-6">
          <Link href="/shop">{t("continueShopping")}</Link>
        </Button>
      </div>
    );
  }

  const lines = cart?.lines ?? [];
  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_340px]">
      <div className="grid content-start gap-4">
        {offlineSince !== null && (
          <div
            role="status"
            className="flex gap-2 rounded-md border border-sky-300 bg-sky-50 p-3 text-sm text-sky-900 dark:border-sky-800 dark:bg-sky-950 dark:text-sky-100"
          >
            <WifiOff className="size-4 shrink-0" aria-hidden />
            <p>{t("offlinePrices", { time: formatDateTime(new Date(offlineSince), locale) })}</p>
          </div>
        )}
        {notices.length > 0 && (
          <div
            role="status"
            className="flex gap-2 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900"
          >
            <TriangleAlert className="size-4 shrink-0" aria-hidden />
            <ul>
              {notices.map((n, i) => (
                <li key={i}>{n}</li>
              ))}
            </ul>
          </div>
        )}
        <ul className="divide-y rounded-lg border">
          {lines.map((line) => {
            const name = localize(line.name, locale);
            return (
              <li
                key={line.variantId}
                className="flex flex-wrap items-center justify-between gap-4 p-4"
              >
                <LineSummary line={line} locale={locale} />
                <div className="flex items-center gap-4">
                  <div
                    className="inline-flex items-center rounded-md border"
                    role="group"
                    aria-label={`${tProduct("quantity")}: ${name}`}
                  >
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-8"
                      onClick={() => setQuantity(line.variantId, line.quantity - 1)}
                      aria-label={tProduct("decrease")}
                    >
                      <Minus className="size-4" aria-hidden />
                    </Button>
                    <output className="w-8 text-center text-sm tabular-nums" aria-live="polite">
                      {line.quantity}
                    </output>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-8"
                      disabled={line.quantity >= Math.min(line.stock, 20)}
                      title={line.quantity >= line.stock ? t("maxReached") : undefined}
                      onClick={() => setQuantity(line.variantId, line.quantity + 1)}
                      aria-label={tProduct("increase")}
                    >
                      <Plus className="size-4" aria-hidden />
                    </Button>
                  </div>
                  <div className="w-24 text-right">
                    <p className="font-medium tabular-nums">
                      {formatINR(line.unitPrice * line.quantity, locale)}
                    </p>
                    {line.quantity > 1 && (
                      <p className="text-xs text-muted-foreground">
                        {t("each", { price: formatINR(line.unitPrice, locale) })}
                      </p>
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => remove(line.variantId)}
                    aria-label={t("removeItem", { name })}
                  >
                    <Trash2 className="size-4" aria-hidden />
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      </div>
      <aside className="grid h-fit gap-4 rounded-lg border p-5 lg:sticky lg:top-20">
        <div className="flex items-baseline justify-between">
          <span className="font-medium">{t("subtotal")}</span>
          <span className="text-xl font-semibold tabular-nums">
            {formatINR(cart?.subtotal ?? 0, locale)}
          </span>
        </div>
        <p className="text-xs text-muted-foreground">{t("taxesShipping")}</p>
        {offlineSince !== null ? (
          <Button size="lg" disabled>
            {t("checkoutOffline")}
          </Button>
        ) : (
          <Button asChild size="lg" disabled={lines.length === 0}>
            <Link href="/checkout">{t("checkout")}</Link>
          </Button>
        )}
        <Button asChild variant="ghost">
          <Link href="/shop">{t("continueShopping")}</Link>
        </Button>
      </aside>
    </div>
  );
}
