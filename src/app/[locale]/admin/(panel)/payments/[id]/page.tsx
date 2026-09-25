import { notFound } from "next/navigation";
import type { Locale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import {
  PaymentStatusBadge,
  RefundStatusBadge,
} from "@/components/admin/payments/payment-status-badge";
import { RefundForm } from "@/components/admin/payments/refund-form";
import { AdminPageHeader } from "@/components/admin/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requirePermission } from "@/lib/auth-guards";
import { can } from "@/lib/permissions";
import { getPaymentDetail, refundableAmount } from "@/lib/services/payment.service";
import { formatDateTime } from "@/lib/utils/format";
import { formatINR } from "@/lib/utils/money";
import { formatIndianMobile } from "@/lib/utils/phone";

export async function generateMetadata() {
  const t = await getTranslations("Payments");
  return { title: t("detailTitle") };
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-1 sm:grid-cols-[12rem_1fr]">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="text-sm break-all">{children}</dd>
    </div>
  );
}

export default async function PaymentDetailPage({
  params,
}: PageProps<"/[locale]/admin/payments/[id]">) {
  const { locale, id } = await params;
  setRequestLocale(locale as Locale);
  const user = await requirePermission("orders:read", locale, `/${locale}/admin/payments/${id}`);
  const payment = await getPaymentDetail(id);
  if (!payment) notFound();
  const [t, tOrder] = await Promise.all([getTranslations("Payments"), getTranslations("Order")]);
  const money = (paise: number) => formatINR(paise, locale);
  const refundable = refundableAmount(payment);
  const canRefund = can(user.role, "payments:refund");
  const reasonText = (reason: string | null) => {
    if (!reason) return "—";
    const key = `reasons.${reason}` as "reasons.order_expired";
    return t.has(key) ? t(key) : reason;
  };
  const meta = (payment.metadata ?? {}) as { method?: string; duplicateOf?: string };

  return (
    <>
      <AdminPageHeader
        title={t("detailHeading", { number: payment.order.orderNumber })}
        breadcrumbs={[
          { label: t("title"), href: "/admin/payments" },
          { label: payment.order.orderNumber },
        ]}
      />
      <div className="grid gap-6 lg:grid-cols-[1fr_22rem]">
        <Card>
          <CardHeader>
            <CardTitle>{t("details")}</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid gap-3">
              <Row label={t("status")}>
                <PaymentStatusBadge status={payment.status} />
              </Row>
              <Row label={t("amount")}>
                <span className="tabular-nums">{money(payment.amount)}</span>
              </Row>
              {payment.refundedAmount > 0 && (
                <Row label={t("refunded")}>
                  <span className="tabular-nums">{money(payment.refundedAmount)}</span>
                </Row>
              )}
              <Row label={t("method")}>
                {t(`methods.${payment.method}`)}
                {meta.method && ` · ${meta.method}`}
              </Row>
              <Row label={t("provider")}>
                {payment.provider}
                {payment.provider === "mock" && ` (${t("testMode")})`}
              </Row>
              {payment.providerOrderId && (
                <Row label={t("providerOrderId")}>
                  <code className="text-xs">{payment.providerOrderId}</code>
                </Row>
              )}
              {payment.providerPaymentId && (
                <Row label={t("providerPaymentId")}>
                  <code className="text-xs">{payment.providerPaymentId}</code>
                </Row>
              )}
              {payment.failureReason && (
                <Row label={t("failureReason")}>{payment.failureReason}</Row>
              )}
              {meta.duplicateOf && <Row label={t("note")}>{t("duplicateNote")}</Row>}
              <Row label={t("createdAt")}>{formatDateTime(payment.createdAt, locale)}</Row>
              <Row label={t("order")}>
                {payment.order.orderNumber} · {tOrder(`status${payment.order.status}`)} ·{" "}
                {money(payment.order.total)}
              </Row>
              <Row label={t("customer")}>
                {payment.order.customerName} · {formatIndianMobile(payment.order.customerPhone)}
                {payment.order.customerEmail && ` · ${payment.order.customerEmail}`}
              </Row>
            </dl>
          </CardContent>
        </Card>

        <Card className="self-start">
          <CardHeader>
            <CardTitle>{t("refundTitle")}</CardTitle>
          </CardHeader>
          <CardContent className="text-sm">
            {payment.method === "COD" ? (
              <p className="text-muted-foreground">{t("codRefundNote")}</p>
            ) : !canRefund ? (
              <p className="text-muted-foreground">{t("refundOwnerOnly")}</p>
            ) : refundable > 0 ? (
              <RefundForm key={refundable} paymentId={payment.id} maxAmount={refundable} />
            ) : (
              <p className="text-muted-foreground">{t("notRefundable")}</p>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>{t("refunds")}</CardTitle>
          </CardHeader>
          <CardContent>
            {payment.refunds.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("noRefunds")}</p>
            ) : (
              <ul className="divide-y">
                {payment.refunds.map((r) => (
                  <li
                    key={r.id}
                    className="grid gap-1 py-3 sm:grid-cols-[8rem_1fr_auto] sm:items-center sm:gap-4"
                  >
                    <span className="font-medium tabular-nums">{money(r.amount)}</span>
                    <span className="text-sm">
                      {reasonText(r.reason)}
                      <span className="block text-xs text-muted-foreground">
                        {formatDateTime(r.createdAt, locale)} ·{" "}
                        {r.actor?.name ?? r.actor?.email ?? t("system")}
                        {r.providerRefundId && ` · ${r.providerRefundId}`}
                      </span>
                      {r.failureReason && (
                        <span className="block text-xs text-destructive">{r.failureReason}</span>
                      )}
                    </span>
                    <RefundStatusBadge status={r.status} />
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
