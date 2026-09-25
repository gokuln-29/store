import { CircleCheck, CircleX, Clock } from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import type { Locale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { OrderSummary } from "@/components/store/order/order-summary";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { requireUser } from "@/lib/auth-guards";
import { getCustomerOrder } from "@/lib/services/checkout.service";
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

export default async function OrderPage({ params }: PageProps<"/[locale]/order/[orderNumber]">) {
  const { locale, orderNumber } = await params;
  setRequestLocale(locale as Locale);
  const user = await requireUser(locale, `/${locale}/order/${orderNumber}`);
  // Scoped to the customer: someone else's order number is a 404.
  const order = await getCustomerOrder(decodeURIComponent(orderNumber), user.id);
  if (!order) notFound();
  const t = await getTranslations("Order");
  const address = order.shippingAddress as Snapshot;
  const pending = order.status === "PENDING_PAYMENT";
  const cancelled = order.status === "CANCELLED";
  // Money came in after the order was cancelled (e.g. paid after the window closed).
  const refunding =
    cancelled && ["CAPTURED", "PARTIALLY_REFUNDED", "REFUNDED"].includes(order.paymentStatus);
  const heading = pending ? t("awaitingPayment") : cancelled ? t("cancelledTitle") : t("thanks");
  const hint = pending
    ? order.paymentStatus === "FAILED"
      ? t("lastAttemptFailed")
      : t("awaitingPaymentHint")
    : cancelled
      ? refunding
        ? t("lateRefundHint")
        : t("expiredHint")
      : t("confirmationHint", { phone: formatIndianMobile(order.customerPhone) });
  const paymentLabel =
    order.paymentMethod === "COD"
      ? t("methodCOD")
      : order.paymentStatus === "REFUNDED"
        ? t("paymentRefunded")
        : order.paymentStatus === "PARTIALLY_REFUNDED"
          ? t("paymentPartiallyRefunded")
          : order.paymentStatus === "CAPTURED"
            ? t("methodONLINE")
            : cancelled
              ? t("notPaid")
              : t("awaitingPayment");

  return (
    <div className="container mx-auto grid max-w-3xl grid-cols-1 gap-8 px-4 py-8">
      <div className="grid justify-items-center gap-2 text-center">
        {pending ? (
          <Clock className="size-12 text-amber-600" aria-hidden />
        ) : cancelled ? (
          <CircleX className="size-12 text-muted-foreground" aria-hidden />
        ) : (
          <CircleCheck className="size-12 text-emerald-600" aria-hidden />
        )}
        <h1 className="text-2xl font-bold">{heading}</h1>
        <p className="text-muted-foreground">{t("number", { number: order.orderNumber })}</p>
        <p className="text-sm text-muted-foreground">{hint}</p>
        {pending && (
          <Button asChild className="mt-2">
            <Link href={`/checkout/pay/${order.orderNumber}`}>{t("completePayment")}</Link>
          </Button>
        )}
      </div>

      <OrderSummary order={order} locale={locale} />

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
          <p className="text-muted-foreground">{paymentLabel}</p>
          <p>
            {t("status")}: <Badge variant="secondary">{t(`status${order.status}`)}</Badge>
          </p>
        </section>
      </div>

      <div className="text-center">
        <div className="flex flex-wrap justify-center gap-2">
          {!pending && (
            <Button asChild>
              <Link href={`/account/orders/${order.orderNumber}`}>{t("viewDetails")}</Link>
            </Button>
          )}
          <Button asChild variant="outline">
            <Link href="/shop">{t("continueShopping")}</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
