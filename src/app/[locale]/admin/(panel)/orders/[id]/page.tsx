import { Download, FileText } from "lucide-react";
import { notFound } from "next/navigation";
import type { Locale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { NoteForm } from "@/components/admin/orders/note-form";
import { OrderActions } from "@/components/admin/orders/order-actions";
import { OrderTimeline } from "@/components/admin/orders/order-timeline";
import { TrackingForm } from "@/components/admin/orders/tracking-form";
import { AdminPageHeader } from "@/components/admin/page-header";
import { PaymentStatusBadge } from "@/components/admin/payments/payment-status-badge";
import { OrderStatusBadge } from "@/components/shared/order-status-badge";
import { OrderSummary } from "@/components/store/order/order-summary";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Link } from "@/i18n/navigation";
import { requirePermission } from "@/lib/auth-guards";
import { can } from "@/lib/permissions";
import { getAdminOrder } from "@/lib/services/order.service";
import { nextStatuses } from "@/lib/services/order-status";
import { refundableAmount } from "@/lib/services/payment.service";
import { formatDateTime } from "@/lib/utils/format";
import { formatINR } from "@/lib/utils/money";
import { formatIndianMobile } from "@/lib/utils/phone";

export async function generateMetadata() {
  const t = await getTranslations("AdminOrders");
  return { title: t("detailTitle") };
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

export default async function AdminOrderPage({ params }: PageProps<"/[locale]/admin/orders/[id]">) {
  const { locale, id } = await params;
  setRequestLocale(locale as Locale);
  const user = await requirePermission("orders:read", locale, `/${locale}/admin/orders/${id}`);
  const order = await getAdminOrder(id);
  if (!order) notFound();
  const [t, tPay] = await Promise.all([
    getTranslations("AdminOrders"),
    getTranslations("Payments"),
  ]);
  const address = order.shippingAddress as Snapshot;
  const canManage = can(user.role, "orders:manage");
  const main = order.payments.find(
    (p) => !(p.metadata && typeof p.metadata === "object" && "duplicateOf" in p.metadata),
  );
  const refundOnCancel = order.paymentMethod === "ONLINE" && main ? refundableAmount(main) : 0;
  const tracking = {
    courierName: order.courierName ?? "",
    trackingNumber: order.trackingNumber ?? "",
    trackingUrl: order.trackingUrl ?? "",
  };
  const shipped = ["SHIPPED", "DELIVERED", "RETURNED"].includes(order.status);
  const number = encodeURIComponent(order.orderNumber);

  return (
    <>
      <AdminPageHeader
        title={t("heading", { number: order.orderNumber })}
        description={t("placedOn", { date: formatDateTime(order.createdAt, locale) })}
        breadcrumbs={[{ label: t("title"), href: "/admin/orders" }, { label: order.orderNumber }]}
        actions={
          <>
            {order.invoiceNumber && (
              <Button asChild variant="outline" size="sm">
                <a href={`/api/orders/${number}/invoice`} download>
                  <Download aria-hidden />
                  {t("downloadInvoice")}
                </a>
              </Button>
            )}
            {order.status !== "PENDING_PAYMENT" && (
              <Button asChild variant="outline" size="sm">
                <a href={`/api/admin/orders/${number}/packing-slip`} download>
                  <FileText aria-hidden />
                  {t("packingSlip")}
                </a>
              </Button>
            )}
          </>
        }
      />
      <div className="grid gap-6 lg:grid-cols-[1fr_22rem]">
        <div className="grid min-w-0 content-start gap-6">
          <Card>
            <CardContent className="pt-6">
              <OrderSummary order={order} locale={locale} />
              {order.customerNote && (
                <p className="mt-4 rounded-md bg-muted p-3 text-sm">
                  <span className="font-medium">{t("customerNote")}: </span>
                  {order.customerNote}
                </p>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>{t("timeline")}</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-6">
              {canManage && <NoteForm orderId={order.id} />}
              <OrderTimeline events={order.events} locale={locale} />
            </CardContent>
          </Card>
        </div>

        <div className="grid content-start gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between gap-2">
                {t("status")}
                <OrderStatusBadge status={order.status} />
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 text-sm">
              {order.cancelReason && (
                <p>
                  <span className="text-muted-foreground">{t("cancelReason")}: </span>
                  {order.cancelReason}
                </p>
              )}
              {canManage ? (
                <OrderActions
                  orderId={order.id}
                  status={order.status}
                  next={nextStatuses(order.status)}
                  refundOnCancel={refundOnCancel}
                  canRefund={can(user.role, "payments:refund")}
                  tracking={tracking}
                />
              ) : (
                <p className="text-muted-foreground">{t("readOnly")}</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t("shipping")}</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 text-sm">
              <address className="not-italic">
                <span className="font-medium">{address.name}</span>
                <br />
                {address.line1}
                {address.line2 ? `, ${address.line2}` : ""}
                {address.landmark ? `, ${address.landmark}` : ""}
                <br />
                {address.city}, {address.state} {address.pincode}
                <br />
                {formatIndianMobile(address.phone)}
              </address>
              {order.invoiceNumber ? (
                <p>
                  <span className="text-muted-foreground">{t("invoiceNumber")}: </span>
                  {order.invoiceNumber}
                </p>
              ) : (
                <p className="text-muted-foreground">{t("invoiceAfterShipping")}</p>
              )}
              {shipped &&
                (canManage ? (
                  <TrackingForm orderId={order.id} initial={tracking} />
                ) : (
                  <p>
                    {[order.courierName, order.trackingNumber].filter(Boolean).join(" · ") ||
                      t("noTracking")}
                  </p>
                ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t("customer")}</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-1 text-sm">
              <p className="font-medium">{order.customerName}</p>
              <p>{formatIndianMobile(order.customerPhone)}</p>
              {order.customerEmail && <p className="break-all">{order.customerEmail}</p>}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between gap-2">
                {t("payment")}
                <PaymentStatusBadge status={order.paymentStatus} />
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-2 text-sm">
              {order.payments.map((p) => (
                <Link
                  key={p.id}
                  href={`/admin/payments/${p.id}`}
                  className="flex items-center justify-between gap-2 rounded-md border p-2 hover:bg-accent"
                >
                  <span>
                    {tPay(`methods.${p.method}`)}
                    <span className="block text-xs text-muted-foreground">
                      {tPay(`statuses.${p.status}`)}
                      {p.refundedAmount > 0 &&
                        ` · ${tPay("refunded")} ${formatINR(p.refundedAmount, locale)}`}
                    </span>
                  </span>
                  <span className="tabular-nums">{formatINR(p.amount, locale)}</span>
                </Link>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
