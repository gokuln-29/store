import { ArrowLeft, Download, ExternalLink } from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import type { Locale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { OrderStatusBadge } from "@/components/shared/order-status-badge";
import { CancelOrderButton } from "@/components/store/order/cancel-order-button";
import { OrderProgress } from "@/components/store/order/order-progress";
import { OrderSummary } from "@/components/store/order/order-summary";
import { ReorderButton } from "@/components/store/order/reorder-button";
import { ReviewDialog } from "@/components/store/reviews/review-dialog";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { requireUser } from "@/lib/auth-guards";
import { getCustomerOrder } from "@/lib/services/checkout.service";
import { getCustomerOrderDetail } from "@/lib/services/order.service";
import { canCustomerCancel } from "@/lib/services/order-status";
import { myReviews } from "@/lib/services/review.service";
import { getFeatures } from "@/lib/services/settings.service";
import { localize } from "@/lib/utils/localized";
import { formatDateTime } from "@/lib/utils/format";
import { formatINR } from "@/lib/utils/money";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/account/orders/[orderNumber]">): Promise<Metadata> {
  const { orderNumber } = await params;
  const t = await getTranslations("Order");
  return {
    title: t("number", { number: decodeURIComponent(orderNumber) }),
    robots: { index: false },
  };
}

type Snapshot = {
  name: string;
  line1: string;
  line2: string | null;
  city: string;
  state: string;
  pincode: string;
};

function safeHttpUrl(value: string | null): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : null;
  } catch {
    return null;
  }
}

export default async function MyOrderPage({
  params,
}: PageProps<"/[locale]/account/orders/[orderNumber]">) {
  const { locale, orderNumber } = await params;
  setRequestLocale(locale as Locale);
  const number = decodeURIComponent(orderNumber);
  const user = await requireUser(locale, `/${locale}/account/orders/${orderNumber}`);
  // Expires an overdue unpaid order first, so the page never shows a stale state.
  if (!(await getCustomerOrder(number, user.id))) notFound();
  const order = await getCustomerOrderDetail(number, user.id);
  if (!order) notFound();

  const [t, tOrder, tReviews, features] = await Promise.all([
    getTranslations("MyOrders"),
    getTranslations("Order"),
    getTranslations("Reviews"),
    getFeatures(),
  ]);
  // Delivered items that can still be reviewed (one review per product).
  const reviewable = [
    ...new Map(
      order.items
        .filter((i): i is typeof i & { productId: string } => !!i.productId)
        .map((i) => [
          i.productId,
          { productId: i.productId, name: localize(i.productName, locale) },
        ]),
    ).values(),
  ];
  const myReviewsByProduct =
    features.reviews && order.status === "DELIVERED"
      ? await myReviews(
          user.id,
          reviewable.map((i) => i.productId),
        )
      : new Map();
  const address = order.shippingAddress as Snapshot;
  const paidOnline =
    order.paymentMethod === "ONLINE" &&
    ["CAPTURED", "PARTIALLY_REFUNDED"].includes(order.paymentStatus);
  const trackingUrl = safeHttpUrl(order.trackingUrl);
  const paymentLabel =
    order.paymentMethod === "COD"
      ? tOrder("methodCOD")
      : order.paymentStatus === "REFUNDED"
        ? tOrder("paymentRefunded")
        : order.paymentStatus === "PARTIALLY_REFUNDED"
          ? tOrder("paymentPartiallyRefunded")
          : order.paymentStatus === "CAPTURED"
            ? tOrder("methodONLINE")
            : tOrder("notPaid");

  return (
    <article className="grid gap-6">
      <div className="grid gap-2">
        <Link
          href="/account/orders"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:underline"
        >
          <ArrowLeft className="size-4" aria-hidden />
          {t("back")}
        </Link>
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="text-xl font-semibold">
            {tOrder("number", { number: order.orderNumber })}
          </h2>
          <OrderStatusBadge status={order.status} />
        </div>
        <p className="text-sm text-muted-foreground">
          {t("placedOn", { date: formatDateTime(order.createdAt, locale) })}
        </p>
      </div>

      {order.status === "PENDING_PAYMENT" && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-amber-500/40 bg-amber-500/10 p-4 text-sm">
          <span>{tOrder("awaitingPaymentHint")}</span>
          <Button asChild size="sm">
            <Link href={`/checkout/pay/${order.orderNumber}`}>{tOrder("completePayment")}</Link>
          </Button>
        </div>
      )}
      {order.status === "CANCELLED" && (
        <p className="rounded-lg border bg-muted p-4 text-sm">
          {t("cancelledOn", {
            date: order.cancelledAt ? formatDateTime(order.cancelledAt, locale) : "",
          })}
          {order.cancelReason && ` ${t("reason", { reason: order.cancelReason })}`}
        </p>
      )}

      {order.status !== "PENDING_PAYMENT" && (
        <section aria-labelledby="progress-heading" className="grid gap-3">
          <h3 id="progress-heading" className="font-semibold">
            {t("progress")}
          </h3>
          <OrderProgress status={order.status} events={order.events} locale={locale} />
        </section>
      )}

      {order.trackingNumber && (
        <section
          aria-labelledby="tracking-heading"
          className="grid gap-2 rounded-lg border p-4 text-sm"
        >
          <h3 id="tracking-heading" className="font-semibold">
            {t("tracking")}
          </h3>
          <p>
            {order.courierName && `${order.courierName} · `}
            {t("trackingNumber", { number: order.trackingNumber })}
          </p>
          {trackingUrl && (
            <a
              href={trackingUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 font-medium text-primary hover:underline"
            >
              {t("trackParcel")}
              <ExternalLink className="size-4" aria-hidden />
            </a>
          )}
        </section>
      )}

      <div className="flex flex-wrap gap-2">
        {canCustomerCancel(order.status) && (
          <CancelOrderButton
            orderNumber={order.orderNumber}
            refundAmount={paidOnline ? order.total : 0}
          />
        )}
        {order.status !== "PENDING_PAYMENT" && <ReorderButton orderNumber={order.orderNumber} />}
        {order.invoiceNumber ? (
          <Button asChild variant="outline">
            <a href={`/api/orders/${encodeURIComponent(order.orderNumber)}/invoice`} download>
              <Download aria-hidden />
              {t("invoice")}
            </a>
          </Button>
        ) : (
          ["PLACED", "CONFIRMED", "PACKED"].includes(order.status) && (
            <p className="self-center text-sm text-muted-foreground">{t("invoiceSoon")}</p>
          )
        )}
      </div>

      {features.reviews && order.status === "DELIVERED" && reviewable.length > 0 && (
        <section aria-labelledby="review-heading" className="grid gap-3 rounded-lg border p-4">
          <h3 id="review-heading" className="font-semibold">
            {tReviews("reviewItems")}
          </h3>
          <ul className="divide-y">
            {reviewable.map((item) => {
              const mine = myReviewsByProduct.get(item.productId);
              return (
                <li
                  key={item.productId}
                  className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm"
                >
                  <span>{item.name}</span>
                  {mine ? (
                    <span className="text-muted-foreground">
                      {mine.status === "APPROVED"
                        ? tReviews("statusApproved")
                        : mine.status === "PENDING"
                          ? tReviews("statusPending")
                          : tReviews("statusRejected")}
                    </span>
                  ) : (
                    <ReviewDialog
                      productId={item.productId}
                      productName={item.name}
                      photosEnabled={features.reviewPhotos}
                    />
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <OrderSummary order={order} locale={locale} />

      <div className="grid gap-6 sm:grid-cols-2">
        <section aria-labelledby="address-heading" className="grid gap-1 text-sm">
          <h3 id="address-heading" className="mb-1 font-semibold">
            {tOrder("deliverTo")}
          </h3>
          <address className="text-muted-foreground not-italic">
            {address.name}
            <br />
            {address.line1}
            {address.line2 ? `, ${address.line2}` : ""}
            <br />
            {address.city}, {address.state} {address.pincode}
          </address>
        </section>
        <section aria-labelledby="payment-heading" className="grid content-start gap-1 text-sm">
          <h3 id="payment-heading" className="mb-1 font-semibold">
            {tOrder("paymentMethod")}
          </h3>
          <p className="text-muted-foreground">
            {paymentLabel} · {formatINR(order.total, locale)}
          </p>
        </section>
      </div>
    </article>
  );
}
