import { CircleCheck, Clock } from "lucide-react";
import type { Metadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";
import type { Locale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { requireUser } from "@/lib/auth-guards";
import { getCustomerOrder } from "@/lib/services/checkout.service";
import { isLocalUpload } from "@/lib/utils/images";
import { localize } from "@/lib/utils/localized";
import { formatINR } from "@/lib/utils/money";
import { formatIndianMobile } from "@/lib/utils/phone";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/order/[orderNumber]">): Promise<Metadata> {
  const { orderNumber } = await params;
  const t = await getTranslations("Order");
  return {
    title: t("number", { number: decodeURIComponent(orderNumber) }),
    robots: { index: false },
  };
}

type Snapshot = {
  name: string;
  phone: string;
  line1: string;
  line2: string | null;
  landmark: string | null;
  city: string;
  state: string;
  pincode: string;
};
type OptionSnapshot = { label: unknown; value: unknown }[];

export default async function OrderPage({ params }: PageProps<"/[locale]/order/[orderNumber]">) {
  const { locale, orderNumber } = await params;
  setRequestLocale(locale as Locale);
  const user = await requireUser(locale, `/${locale}/order/${orderNumber}`);
  // Scoped to the customer: someone else's order number is a 404.
  const order = await getCustomerOrder(decodeURIComponent(orderNumber), user.id);
  if (!order) notFound();
  const [t, tCheckout] = await Promise.all([getTranslations("Order"), getTranslations("Checkout")]);
  const money = (paise: number) => formatINR(paise, locale);
  const address = order.shippingAddress as Snapshot;
  const pending = order.status === "PENDING_PAYMENT";

  return (
    <div className="container mx-auto grid max-w-3xl grid-cols-1 gap-8 px-4 py-8">
      <div className="grid justify-items-center gap-2 text-center">
        {pending ? (
          <Clock className="size-12 text-amber-600" aria-hidden />
        ) : (
          <CircleCheck className="size-12 text-emerald-600" aria-hidden />
        )}
        <h1 className="text-2xl font-bold">{pending ? t("awaitingPayment") : t("thanks")}</h1>
        <p className="text-muted-foreground">{t("number", { number: order.orderNumber })}</p>
        <p className="text-sm text-muted-foreground">
          {pending
            ? t("awaitingPaymentHint")
            : t("confirmationHint", { phone: formatIndianMobile(order.customerPhone) })}
        </p>
        {pending && (
          <Button asChild className="mt-2">
            <Link href={`/checkout/pay/${order.orderNumber}`}>{t("completePayment")}</Link>
          </Button>
        )}
      </div>

      <section aria-labelledby="items-heading" className="grid gap-3">
        <h2 id="items-heading" className="text-lg font-semibold">
          {t("items")}
        </h2>
        <ul className="divide-y rounded-lg border">
          {order.items.map((item) => {
            const options = ((item.optionValues as OptionSnapshot) ?? [])
              .map((o) => localize(o.value, locale) || String(o.value))
              .join(" / ");
            return (
              <li key={item.id} className="flex items-center gap-3 p-3">
                <span className="relative size-14 shrink-0 overflow-hidden rounded-md bg-muted">
                  {item.imageUrl && (
                    <Image
                      src={item.imageUrl}
                      alt=""
                      fill
                      sizes="56px"
                      className="object-cover"
                      unoptimized={isLocalUpload(item.imageUrl)}
                    />
                  )}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">{localize(item.productName, locale)}</p>
                  <p className="text-xs text-muted-foreground">
                    {options && `${options} · `}
                    {tCheckout("qty", { count: item.quantity })}
                  </p>
                </div>
                {/* Before discount, so the lines add up to the subtotal; the discount is listed below. */}
                <p className="text-sm tabular-nums">{money(item.unitPrice * item.quantity)}</p>
              </li>
            );
          })}
        </ul>
        <dl className="grid gap-2 text-sm">
          <div className="flex justify-between">
            <dt>{tCheckout("subtotal")}</dt>
            <dd className="tabular-nums">{money(order.subtotal)}</dd>
          </div>
          {order.discountTotal > 0 && (
            <div className="flex justify-between text-emerald-700">
              <dt>
                {tCheckout("discount")}
                {order.couponCode && ` (${order.couponCode})`}
              </dt>
              <dd className="tabular-nums">−{money(order.discountTotal)}</dd>
            </div>
          )}
          <div className="flex justify-between">
            <dt>{tCheckout("shippingLine")}</dt>
            <dd className="tabular-nums">
              {order.shippingTotal === 0 ? tCheckout("free") : money(order.shippingTotal)}
            </dd>
          </div>
          {order.codFee > 0 && (
            <div className="flex justify-between">
              <dt>{tCheckout("codFee")}</dt>
              <dd className="tabular-nums">{money(order.codFee)}</dd>
            </div>
          )}
          {!order.pricesIncludeTax && (
            <div className="flex justify-between">
              <dt>{tCheckout("gst")}</dt>
              <dd className="tabular-nums">{money(order.taxTotal)}</dd>
            </div>
          )}
          <div className="flex justify-between border-t pt-2 text-base font-semibold">
            <dt>{tCheckout("total")}</dt>
            <dd className="tabular-nums">{money(order.total)}</dd>
          </div>
          {order.pricesIncludeTax && order.taxTotal > 0 && (
            <p className="text-xs text-muted-foreground">
              {tCheckout("gstIncluded", { amount: money(order.taxTotal) })}
            </p>
          )}
        </dl>
      </section>

      <div className="grid gap-6 sm:grid-cols-2">
        <section aria-labelledby="address-heading" className="grid gap-1 text-sm">
          <h2 id="address-heading" className="mb-1 font-semibold">
            {t("deliverTo")}
          </h2>
          <address className="text-muted-foreground not-italic">
            {address.name}
            <br />
            {address.line1}
            {address.line2 ? `, ${address.line2}` : ""}
            <br />
            {address.city}, {address.state} {address.pincode}
          </address>
        </section>
        <section aria-labelledby="payment-heading" className="grid content-start gap-2 text-sm">
          <h2 id="payment-heading" className="font-semibold">
            {t("paymentMethod")}
          </h2>
          <p className="text-muted-foreground">
            {order.paymentMethod === "COD"
              ? t("methodCOD")
              : pending
                ? t("awaitingPayment")
                : t("methodONLINE")}
          </p>
          <p>
            {t("status")}: <Badge variant="secondary">{t(`status${order.status}`)}</Badge>
          </p>
        </section>
      </div>

      <div className="text-center">
        <Button asChild variant="outline">
          <Link href="/shop">{t("continueShopping")}</Link>
        </Button>
      </div>
    </div>
  );
}
