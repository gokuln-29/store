import type { Locale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { PaymentStatusBadge } from "@/components/admin/payments/payment-status-badge";
import { DataTable, type Column } from "@/components/admin/data-table/data-table";
import { DataTableToolbar } from "@/components/admin/data-table/toolbar";
import { AdminPageHeader } from "@/components/admin/page-header";
import type { PaymentMethod, PaymentStatus } from "@/generated/prisma/client";
import { Link } from "@/i18n/navigation";
import { requirePermission } from "@/lib/auth-guards";
import { listPayments } from "@/lib/services/payment.service";
import { formatDateTime } from "@/lib/utils/format";
import { formatINR } from "@/lib/utils/money";
import { formatIndianMobile } from "@/lib/utils/phone";
import { parseTableParams } from "@/lib/utils/table-params";

const STATUSES = [
  "PENDING",
  "AUTHORIZED",
  "CAPTURED",
  "FAILED",
  "PARTIALLY_REFUNDED",
  "REFUNDED",
] as const satisfies readonly PaymentStatus[];
const METHODS = ["ONLINE", "COD"] as const satisfies readonly PaymentMethod[];

export async function generateMetadata() {
  const t = await getTranslations("Payments");
  return { title: t("title") };
}

export default async function PaymentsPage({
  params,
  searchParams,
}: PageProps<"/[locale]/admin/payments">) {
  const { locale } = await params;
  setRequestLocale(locale as Locale);
  await requirePermission("orders:read", locale, `/${locale}/admin/payments`);
  const [t, tData] = await Promise.all([getTranslations("Payments"), getTranslations("DataTable")]);
  const tableParams = parseTableParams(await searchParams, {
    sortable: ["createdAt"] as const,
    defaultSort: "createdAt",
    filters: { status: STATUSES, method: METHODS },
  });
  const { rows, total } = await listPayments({
    page: tableParams.page,
    pageSize: tableParams.pageSize,
    q: tableParams.q || undefined,
    status: tableParams.filters.status as PaymentStatus | undefined,
    method: tableParams.filters.method as PaymentMethod | undefined,
  });
  const money = (paise: number) => formatINR(paise, locale);

  type Row = (typeof rows)[number];
  const columns: Column<Row>[] = [
    {
      key: "order",
      header: t("order"),
      cell: (r) => (
        <Link href={`/admin/payments/${r.id}`} className="font-medium hover:underline">
          {r.order.orderNumber}
          <span className="block text-xs font-normal text-muted-foreground">
            {formatDateTime(r.createdAt, locale)}
          </span>
        </Link>
      ),
    },
    {
      key: "customer",
      header: t("customer"),
      hideOnMobile: true,
      cell: (r) => (
        <span className="text-sm">
          {r.order.customerName}
          <span className="block text-xs text-muted-foreground">
            {formatIndianMobile(r.order.customerPhone)}
          </span>
        </span>
      ),
    },
    {
      key: "method",
      header: t("method"),
      hideOnMobile: true,
      cell: (r) => (
        <span className="text-sm">
          {t(`methods.${r.method}`)}
          {r.provider === "mock" && (
            <span className="ml-1 text-xs text-muted-foreground">({t("testMode")})</span>
          )}
        </span>
      ),
    },
    {
      key: "amount",
      header: t("amount"),
      className: "text-right",
      cell: (r) => (
        <span className="tabular-nums">
          {money(r.amount)}
          {r.refundedAmount > 0 && (
            <span className="block text-xs text-muted-foreground">−{money(r.refundedAmount)}</span>
          )}
        </span>
      ),
    },
    { key: "status", header: t("status"), cell: (r) => <PaymentStatusBadge status={r.status} /> },
  ];

  return (
    <>
      <AdminPageHeader
        title={t("title")}
        description={t("description")}
        breadcrumbs={[{ label: t("title") }]}
      />
      <div className="grid gap-4">
        <DataTableToolbar
          searchPlaceholder={t("searchPlaceholder")}
          filters={[
            {
              key: "status",
              label: t("status"),
              allLabel: t("allStatuses"),
              options: STATUSES.map((s) => ({ value: s, label: t(`statuses.${s}`) })),
            },
            {
              key: "method",
              label: t("method"),
              allLabel: t("allMethods"),
              options: METHODS.map((m) => ({ value: m, label: t(`methods.${m}`) })),
            },
          ]}
        />
        <DataTable
          pathname="/admin/payments"
          rows={rows}
          total={total}
          columns={columns}
          params={tableParams}
          caption={t("title")}
          empty={
            <p className="text-muted-foreground">
              {tableParams.q ? tData("noResults") : t("empty")}
            </p>
          }
        />
      </div>
    </>
  );
}
