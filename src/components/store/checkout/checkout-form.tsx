"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Banknote, CreditCard, Loader2, Tag, TriangleAlert, X } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useMemo, useRef, useState, useSyncExternalStore, useTransition } from "react";
import { useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";
import type { z } from "zod";
import { FormField } from "@/components/shared/form-field";
import { NativeSelect } from "@/components/shared/native-select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useErrorText } from "@/hooks/use-error-text";
import { Link, useRouter } from "@/i18n/navigation";
import { placeOrderAction, quoteCheckoutAction } from "@/lib/actions/checkout.actions";
import { useCart } from "@/lib/cart-store";
import { INDIAN_STATES, stateNameFromCode } from "@/lib/constants/indian-states";
import { pincodeMatchesState } from "@/lib/constants/pincode-zones";
import type { CheckoutQuote } from "@/lib/services/checkout.service";
import { formatINR } from "@/lib/utils/money";
import { cn } from "@/lib/utils";
import { addressSchema, EMPTY_ADDRESS, type AddressInput } from "@/lib/validators/auth";
import { LineSummary } from "../cart/line-item";

export type SavedAddress = {
  id: string;
  name: string;
  phone: string;
  line1: string;
  line2: string | null;
  city: string;
  state: string;
  stateCode: string;
  pincode: string;
  isDefault: boolean;
};

const subscribe = () => () => {};

export function CheckoutForm({
  addresses,
  phone,
  name,
  email,
  codFee,
  couponsEnabled,
}: {
  addresses: SavedAddress[];
  phone: string | null;
  name: string | null;
  email: string | null;
  codFee: number;
  /** Settings → Features: hides the coupon field when off. */
  couponsEnabled: boolean;
}) {
  const t = useTranslations("Checkout");
  const tAddr = useTranslations("Addresses");
  const tCoupon = useTranslations("Coupon");
  const tCommon = useTranslations("Common");
  const tCart = useTranslations("Cart");
  const errorText = useErrorText();
  const locale = useLocale();
  const router = useRouter();
  const hydrated = useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
  const items = useCart((s) => s.items);
  const { replace, clear } = useCart.getState();

  const [choice, setChoice] = useState<string>(
    addresses.find((a) => a.isDefault)?.id ?? addresses[0]?.id ?? "new",
  );
  const [saveNew, setSaveNew] = useState(true);
  const [customerEmail, setCustomerEmail] = useState(email ?? "");
  const [note, setNote] = useState("");
  const [couponInput, setCouponInput] = useState("");
  const [coupon, setCoupon] = useState<string | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<"ONLINE" | "COD" | null>(null);
  const [quote, setQuote] = useState<CheckoutQuote | null>(null);
  const [quoting, setQuoting] = useState(false);
  /** Bumped to force a fresh quote (e.g. after an item sold out). */
  const [refresh, setRefresh] = useState(0);
  const [isPlacing, startPlacing] = useTransition();
  const quoteId = useRef(0);

  const form = useForm<AddressInput, unknown, z.output<typeof addressSchema>>({
    resolver: zodResolver(addressSchema),
    defaultValues: { ...EMPTY_ADDRESS, name: name ?? "", phone: phone?.replace(/^\+91/, "") ?? "" },
  });
  const newAddress = useWatch({ control: form.control });
  const { errors } = form.formState;

  // Where we're delivering, as far as we know yet.
  const destination = useMemo(() => {
    if (choice !== "new") {
      const saved = addresses.find((a) => a.id === choice);
      return saved ? { pincode: saved.pincode, stateCode: saved.stateCode } : null;
    }
    const pincode = newAddress.pincode?.trim() ?? "";
    const stateCode = newAddress.stateCode ?? "";
    return /^[1-9]\d{5}$/.test(pincode) && stateCode ? { pincode, stateCode } : null;
  }, [choice, addresses, newAddress.pincode, newAddress.stateCode]);

  const mismatch =
    choice === "new" &&
    destination &&
    !pincodeMatchesState(destination.pincode, destination.stateCode);

  // Re-quote from the server whenever anything that affects the total changes.
  useEffect(() => {
    if (!hydrated) return;
    const id = ++quoteId.current;
    const timer = setTimeout(async () => {
      setQuoting(true);
      const result = await quoteCheckoutAction({
        items,
        destination,
        couponCode: coupon ?? "",
        paymentMethod,
      }).catch(() => null);
      if (id !== quoteId.current) return;
      setQuoting(false);
      if (!result) return; // interrupted (e.g. navigating away); the next change re-quotes
      if (!result.ok) {
        toast.error(errorText(result.error));
        return;
      }
      setQuote(result.data);
      if (result.data.adjustments.length) {
        replace(result.data.lines.map((l) => ({ variantId: l.variantId, quantity: l.quantity })));
        toast.warning(t("cartChanged"));
      }
      // Pick a sensible default payment method once we know what's available.
      setPaymentMethod(
        (current) =>
          current ??
          (result.data.onlineAvailable ? "ONLINE" : result.data.codAvailable ? "COD" : null),
      );
    }, 300);
    return () => clearTimeout(timer);
  }, [items, destination, coupon, paymentMethod, refresh, hydrated, replace, errorText, t]);

  async function place() {
    if (!quote) return;
    if (choice === "new" && !(await form.trigger())) {
      toast.error(errorText("validation"));
      return;
    }
    if (!paymentMethod) {
      toast.error(t("choosePayment"));
      return;
    }
    startPlacing(async () => {
      const result = await placeOrderAction(
        {
          items,
          address:
            choice === "new"
              ? { kind: "new", address: form.getValues(), save: saveNew }
              : { kind: "saved", addressId: choice },
          couponCode: coupon ?? "",
          paymentMethod,
          customerEmail,
          customerNote: note,
          expectedTotal: quote.price.total,
        },
        locale,
      );
      if (!result.ok) {
        for (const [field, message] of Object.entries(result.fieldErrors ?? {})) {
          const key = field.replace(/^address\.address\./, "") as keyof AddressInput;
          form.setError(key, { message });
        }
        toast.error(errorText(result.fieldErrors ? "validation" : result.error));
        return;
      }
      const outcome = result.data;
      if (outcome.ok) {
        clear();
        router.push(
          outcome.next.type === "redirect" ? outcome.next.url : `/order/${outcome.orderNumber}`,
        );
        return;
      }
      const error = outcome.error;
      switch (error.code) {
        case "total_changed":
          setQuote(error.quote);
          toast.warning(t("pricesChanged"));
          break;
        case "cart_changed":
        case "out_of_stock":
          toast.warning(error.code === "out_of_stock" ? t("outOfStock") : t("cartChanged"));
          if ("quote" in error)
            replace(
              error.quote.lines.map((l) => ({ variantId: l.variantId, quantity: l.quantity })),
            );
          setRefresh((n) => n + 1);
          break;
        case "coupon_rejected":
        case "blocked":
          setQuote(error.quote);
          break;
        case "address_not_found":
          toast.error(errorText("address_not_found"));
          break;
      }
    });
  }

  if (hydrated && items.length === 0) {
    return (
      <div className="py-16 text-center">
        <p className="text-lg font-medium">{tCart("empty")}</p>
        <Button asChild className="mt-6">
          <Link href="/shop">{tCart("continueShopping")}</Link>
        </Button>
      </div>
    );
  }

  const price = quote?.price;
  const couponStatus = quote?.coupon;
  const issues = quote?.issues ?? [];
  const money = (paise: number) => formatINR(paise, locale);
  const issueText = issues
    .map((issue) => {
      switch (issue.code) {
        case "min_order_value":
          return t("minOrder", { amount: money(issue.minOrderValue) });
        case "not_deliverable":
          return t("notDeliverable");
        case "cod_unavailable":
          return `${t("cod")}: ${t("codUnavailable")}`;
        case "online_unavailable":
          return `${t("online")}: ${t("codUnavailable")}`;
        default:
          return null;
      }
    })
    .filter(Boolean) as string[];

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_380px]">
      <div className="grid content-start gap-8">
        {/* Contact */}
        <section aria-labelledby="contact-heading" className="grid gap-3">
          <h2 id="contact-heading" className="text-lg font-semibold">
            {t("contact")}
          </h2>
          <p className="text-sm">
            {t("mobile")}: <span className="font-medium">{phone}</span>
          </p>
          <FormField id="customerEmail" label={t("emailOptional")}>
            {(aria) => (
              <Input
                type="email"
                autoComplete="email"
                value={customerEmail}
                onChange={(e) => setCustomerEmail(e.target.value)}
                className="max-w-sm"
                {...aria}
              />
            )}
          </FormField>
        </section>

        {/* Address */}
        <section aria-labelledby="address-heading" className="grid gap-3">
          <h2 id="address-heading" className="text-lg font-semibold">
            {t("delivery")}
          </h2>
          <div role="radiogroup" aria-labelledby="address-heading" className="grid gap-2">
            {addresses.map((a) => (
              <label
                key={a.id}
                className={cn(
                  "flex cursor-pointer gap-3 rounded-lg border p-3 text-sm",
                  choice === a.id && "border-primary bg-primary/5",
                )}
              >
                <input
                  type="radio"
                  name="address"
                  value={a.id}
                  checked={choice === a.id}
                  onChange={() => setChoice(a.id)}
                  className="mt-1 size-4 accent-primary"
                />
                <span>
                  <span className="font-medium">{a.name}</span> · {a.phone.replace(/^\+91/, "")}
                  <br />
                  <span className="text-muted-foreground">
                    {a.line1}
                    {a.line2 ? `, ${a.line2}` : ""}, {a.city}, {a.state} {a.pincode}
                  </span>
                </span>
              </label>
            ))}
            <label
              className={cn(
                "flex cursor-pointer items-center gap-3 rounded-lg border p-3 text-sm font-medium",
                choice === "new" && "border-primary bg-primary/5",
              )}
            >
              <input
                type="radio"
                name="address"
                value="new"
                checked={choice === "new"}
                onChange={() => setChoice("new")}
                className="size-4 accent-primary"
              />
              {t("newAddress")}
            </label>
          </div>

          {choice === "new" && (
            <div className="grid gap-4 rounded-lg border p-4 sm:grid-cols-2">
              <FormField id="name" label={tAddr("name")} error={errorText(errors.name?.message)}>
                {(aria) => <Input autoComplete="name" {...aria} {...form.register("name")} />}
              </FormField>
              <FormField id="phone" label={tAddr("phone")} error={errorText(errors.phone?.message)}>
                {(aria) => (
                  <Input
                    type="tel"
                    inputMode="numeric"
                    autoComplete="tel-national"
                    {...aria}
                    {...form.register("phone")}
                  />
                )}
              </FormField>
              <FormField
                id="line1"
                label={tAddr("line1")}
                className="sm:col-span-2"
                error={errorText(errors.line1?.message)}
              >
                {(aria) => (
                  <Input autoComplete="address-line1" {...aria} {...form.register("line1")} />
                )}
              </FormField>
              <FormField
                id="line2"
                label={`${tAddr("line2")} (${tCommon("optional")})`}
                className="sm:col-span-2"
              >
                {(aria) => (
                  <Input autoComplete="address-line2" {...aria} {...form.register("line2")} />
                )}
              </FormField>
              <FormField id="landmark" label={`${tAddr("landmark")} (${tCommon("optional")})`}>
                {(aria) => <Input {...aria} {...form.register("landmark")} />}
              </FormField>
              <FormField
                id="pincode"
                label={tAddr("pincode")}
                error={errorText(errors.pincode?.message)}
              >
                {(aria) => (
                  <Input
                    inputMode="numeric"
                    autoComplete="postal-code"
                    maxLength={6}
                    {...aria}
                    {...form.register("pincode")}
                  />
                )}
              </FormField>
              <FormField id="city" label={tAddr("city")} error={errorText(errors.city?.message)}>
                {(aria) => (
                  <Input autoComplete="address-level2" {...aria} {...form.register("city")} />
                )}
              </FormField>
              <FormField
                id="stateCode"
                label={tAddr("state")}
                error={errorText(errors.stateCode?.message)}
              >
                {(aria) => (
                  <NativeSelect
                    autoComplete="address-level1"
                    {...aria}
                    {...form.register("stateCode")}
                  >
                    <option value="" disabled>
                      {tAddr("statePlaceholder")}
                    </option>
                    {INDIAN_STATES.map((s) => (
                      <option key={s.code} value={s.code}>
                        {s.name}
                      </option>
                    ))}
                  </NativeSelect>
                )}
              </FormField>
              {mismatch && destination && (
                <p
                  role="status"
                  className="flex items-center gap-2 text-sm text-amber-800 sm:col-span-2"
                >
                  <TriangleAlert className="size-4 shrink-0" aria-hidden />
                  {t("pincodeMismatch", {
                    state: stateNameFromCode(destination.stateCode) ?? destination.stateCode,
                  })}
                </p>
              )}
              <label className="flex items-center gap-2 text-sm sm:col-span-2">
                <input
                  type="checkbox"
                  checked={saveNew}
                  onChange={(e) => setSaveNew(e.target.checked)}
                  className="size-4 accent-primary"
                />
                {t("saveAddress")}
              </label>
            </div>
          )}
          {quote && destination && (
            <p className="text-sm text-muted-foreground">
              {quote.shipping
                ? quote.shipping.estimatedDaysMin != null && quote.shipping.estimatedDaysMax != null
                  ? t("shippingEta", {
                      min: quote.shipping.estimatedDaysMin,
                      max: quote.shipping.estimatedDaysMax,
                    })
                  : t("shippingStandard")
                : null}
            </p>
          )}
        </section>

        {/* Payment */}
        <section aria-labelledby="payment-heading" className="grid gap-3">
          <h2 id="payment-heading" className="text-lg font-semibold">
            {t("payment")}
          </h2>
          <div role="radiogroup" aria-labelledby="payment-heading" className="grid gap-2">
            {(
              [
                {
                  value: "ONLINE",
                  icon: CreditCard,
                  label: t("online"),
                  hint: t("onlineHint"),
                  available: quote?.onlineAvailable ?? true,
                },
                {
                  value: "COD",
                  icon: Banknote,
                  label: t("cod"),
                  hint: codFee > 0 ? t("codFeeHint", { fee: money(codFee) }) : t("codHint"),
                  available: quote?.codAvailable ?? true,
                },
              ] as const
            ).map((option) => (
              <label
                key={option.value}
                className={cn(
                  "flex cursor-pointer items-center gap-3 rounded-lg border p-3 text-sm",
                  paymentMethod === option.value && "border-primary bg-primary/5",
                  !option.available && "cursor-not-allowed opacity-50",
                )}
              >
                <input
                  type="radio"
                  name="payment"
                  value={option.value}
                  checked={paymentMethod === option.value}
                  disabled={!option.available}
                  onChange={() => setPaymentMethod(option.value)}
                  className="size-4 accent-primary"
                />
                <option.icon className="size-5 text-muted-foreground" aria-hidden />
                <span>
                  <span className="font-medium">{option.label}</span>
                  <br />
                  <span className="text-muted-foreground">
                    {option.available ? option.hint : t("codUnavailable")}
                  </span>
                </span>
              </label>
            ))}
          </div>
          <FormField id="note" label={t("note")}>
            {(aria) => (
              <Textarea
                rows={2}
                maxLength={500}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                {...aria}
              />
            )}
          </FormField>
        </section>
      </div>

      {/* Summary */}
      <aside
        aria-labelledby="summary-heading"
        className="grid h-fit gap-4 rounded-lg border p-5 lg:sticky lg:top-20"
      >
        <h2
          id="summary-heading"
          className="flex items-center justify-between text-lg font-semibold"
        >
          {t("summary")}
          {quoting && (
            <Loader2
              className="size-4 animate-spin text-muted-foreground"
              aria-label={t("calculating")}
            />
          )}
        </h2>
        <ul className="grid max-h-72 gap-3 overflow-y-auto">
          {(quote?.lines ?? []).map((line) => (
            <li key={line.variantId} className="flex items-center justify-between gap-3">
              <LineSummary line={line} locale={locale} compact />
              <div className="shrink-0 text-right text-sm">
                <p className="tabular-nums">{money(line.unitPrice * line.quantity)}</p>
                <p className="text-xs text-muted-foreground">
                  {t("qty", { count: line.quantity })}
                </p>
              </div>
            </li>
          ))}
        </ul>

        {/* Coupon */}
        {couponStatus?.status === "applied" ? (
          <div className="flex items-center justify-between gap-2 rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
            <span className="flex items-center gap-2">
              <Tag className="size-4" aria-hidden />
              {t("couponApplied", {
                code: couponStatus.code,
                amount: money(couponStatus.discount),
              })}
            </span>
            <Button
              variant="ghost"
              size="icon"
              className="size-7"
              onClick={() => setCoupon(null)}
              aria-label={t("removeCoupon")}
            >
              <X className="size-4" aria-hidden />
            </Button>
          </div>
        ) : couponsEnabled ? (
          <form
            className="grid gap-1"
            onSubmit={(e) => {
              e.preventDefault();
              setCoupon(couponInput.trim().toUpperCase() || null);
            }}
          >
            <div className="flex gap-2">
              <Input
                value={couponInput}
                onChange={(e) => setCouponInput(e.target.value)}
                placeholder={t("coupon")}
                aria-label={t("coupon")}
                className="uppercase"
                aria-describedby={couponStatus?.status === "rejected" ? "coupon-error" : undefined}
              />
              <Button type="submit" variant="outline" disabled={!couponInput.trim()}>
                {t("apply")}
              </Button>
            </div>
            {couponStatus?.status === "rejected" && (
              <p id="coupon-error" role="alert" className="text-sm text-destructive">
                {couponStatus.reason === "min_cart_value"
                  ? tCoupon("min_cart_value", { amount: money(couponStatus.minCartValue) })
                  : tCoupon(couponStatus.reason)}
              </p>
            )}
          </form>
        ) : null}

        {price && (
          <dl className="grid gap-2 border-t pt-4 text-sm">
            <div className="flex justify-between">
              <dt>{t("subtotal")}</dt>
              <dd className="tabular-nums">{money(price.subtotal)}</dd>
            </div>
            {price.discountTotal > 0 && (
              <div className="flex justify-between text-emerald-700">
                <dt>{t("discount")}</dt>
                <dd className="tabular-nums">−{money(price.discountTotal)}</dd>
              </div>
            )}
            <div className="flex justify-between">
              <dt>{t("shippingLine")}</dt>
              <dd className="tabular-nums">
                {!destination
                  ? "—"
                  : quote?.shipping
                    ? price.shippingTotal === 0
                      ? t("free")
                      : money(price.shippingTotal)
                    : "—"}
              </dd>
            </div>
            {price.codFee > 0 && (
              <div className="flex justify-between">
                <dt>{t("codFee")}</dt>
                <dd className="tabular-nums">{money(price.codFee)}</dd>
              </div>
            )}
            {!quote.pricesIncludeTax && (
              <div className="flex justify-between">
                <dt>{t("gst")}</dt>
                <dd className="tabular-nums">{money(price.taxTotal)}</dd>
              </div>
            )}
            <div className="flex justify-between border-t pt-3 text-base font-semibold">
              <dt>{t("total")}</dt>
              <dd className="tabular-nums" data-testid="checkout-total">
                {money(price.total)}
              </dd>
            </div>
            {quote.pricesIncludeTax && price.taxTotal > 0 && (
              <p className="text-xs text-muted-foreground">
                {t("gstIncluded", { amount: money(price.taxTotal) })}
              </p>
            )}
          </dl>
        )}
        {!destination && <p className="text-xs text-muted-foreground">{t("enterAddress")}</p>}

        {issueText.length > 0 && (
          <ul
            role="alert"
            className="grid gap-1 rounded-md bg-destructive/10 p-3 text-sm text-destructive"
          >
            {issueText.map((text) => (
              <li key={text}>{text}</li>
            ))}
          </ul>
        )}

        <Button
          size="lg"
          onClick={place}
          disabled={
            !quote || isPlacing || quoting || issues.length > 0 || !destination || !paymentMethod
          }
        >
          {isPlacing ? t("placing") : paymentMethod === "ONLINE" ? t("payNow") : t("placeOrder")}
        </Button>
        <p className="text-center text-xs text-muted-foreground">{t("secure")}</p>
      </aside>
    </div>
  );
}
