import type { Locale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { PaymentStatusBadge } from "@/components/admin/payments/payment-status-badge";
import { DataTable, type Column } from "@/components/admin/data-table/data-table";
import { DataTableToolbar } from "@/components/admin/data-table/toolbar";
import { DateRangeFilter } from "@/components/admin/orders/date-range-filter";
import { AdminPageHeader } from "@/components/admin/page-header";
import { OrderStatusBadge } from "@/components/shared/order-status-badge";
import type { OrderStatus, PaymentMethod, PaymentStatus } from "@/generated/prisma/client";
import { Link } from "@/i18n/navigation";
import { requirePermission } from "@/lib/auth-guards";
import { listOrders } from "@/lib/services/order.service";
import { formatDateTime } from "@/lib/utils/format";
import { formatINR } from "@/lib/utils/money";
import { formatIndianMobile } from "@/lib/utils/phone";
import { parseTableParams } from "@/lib/utils/table-params";
import { ORDER_STATUSES } from "@/lib/validators/orders";

const PAYMENT_STATUSES = [
  "PENDING",
  "CAPTURED",
  "FAILED",
  "PARTIALLY_REFUNDED",
  "REFUNDED",
] as const satisfies readonly PaymentStatus[];
const METHODS = ["ONLINE", "COD"] as const satisfies readonly PaymentMethod[];

export async function generateMetadata() {
  const t = await getTranslations("AdminOrders");
  return { title: t("title") };
}

export default async function OrdersPage({
  params,
  searchParams,
}: PageProps<"/[locale]/admin/orders">) {
  const { locale } = await params;
  setRequestLocale(locale as Locale);
  await requirePermission("orders:read", locale, `/${locale}/admin/orders`);
  const [t, tOrder, tPay, tData] = await Promise.all([
    getTranslations("AdminOrders"),
    getTranslations("Order"),
    getTranslations("Payments"),
    getTranslations("DataTable"),
  ]);
  const raw = await searchParams;
  const tableParams = parseTableParams(raw, {
    sortable: ["createdAt", "total"] as const,
    defaultSort: "createdAt",
    filters: { status: ORDER_STATUSES, payment: PAYMENT_STATUSES, method: METHODS },
  });
  const date = (key: "from" | "to") => {
    const v = raw[key];
    return typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : undefined;
  };
  const { rows, total } = await listOrders({
    page: tableParams.page,
    pageSize: tableParams.pageSize,
    q: tableParams.q || undefined,
    status: tableParams.filters.status as OrderStatus | undefined,
    paymentStatus: tableParams.filters.payment as PaymentStatus | undefined,
    paymentMethod: tableParams.filters.method as PaymentMethod | undefined,
    from: date("from"),
    to: date("to"),
    sort: tableParams.sort,
    dir: tableParams.dir,
  });

  type Row = (typeof rows)[number];
  const columns: Column<Row>[] = [
    {
      key: "order",
      header: t("order"),
      sortKey: "createdAt",
      cell: (r) => (
        <Link href={`/admin/orders/${r.id}`} className="font-medium hover:underline">
          {r.orderNumber}
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
          {r.customerName}
          <span className="block text-xs text-muted-foreground">
            {formatIndianMobile(r.customerPhone)}
          </span>
        </span>
      ),
    },
    {
      key: "items",
      header: t("items"),
      hideOnMobile: true,
      cell: (r) => t("itemCount", { count: r._count.items }),
    },
    {
      key: "total",
      header: t("total"),
      sortKey: "total",
      className: "text-right",
      cell: (r) => (
        <span className="tabular-nums">
          {formatINR(r.total, locale)}
          <span className="block text-xs text-muted-foreground">
            {t(`methods.${r.paymentMethod}`)}
          </span>
        </span>
      ),
    },
    {
      key: "payment",
      header: t("payment"),
      hideOnMobile: true,
      cell: (r) => <PaymentStatusBadge status={r.paymentStatus} />,
    },
    { key: "status", header: t("status"), cell: (r) => <OrderStatusBadge status={r.status} /> },
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
              options: ORDER_STATUSES.map((s) => ({ value: s, label: tOrder(`status${s}`) })),
            },
            {
              key: "payment",
              label: t("payment"),
              allLabel: t("allPayments"),
              options: PAYMENT_STATUSES.map((s) => ({ value: s, label: tPay(`statuses.${s}`) })),
            },
            {
              key: "method",
              label: t("method"),
              allLabel: t("allMethods"),
              options: METHODS.map((m) => ({ value: m, label: t(`methods.${m}`) })),
            },
          ]}
        />
        <DateRangeFilter />
        <DataTable
          pathname="/admin/orders"
          rows={rows}
          total={total}
          columns={columns}
          params={tableParams}
          caption={t("title")}
          empty={
            <p className="text-muted-foreground">
              {tableParams.q ||
              Object.keys(tableParams.filters).length ||
              date("from") ||
              date("to")
                ? tData("noResults")
                : t("empty")}
            </p>
          }
        />
      </div>
    </>
  );
}
