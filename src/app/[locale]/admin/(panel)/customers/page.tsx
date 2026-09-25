import type { Locale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { DataTable, type Column } from "@/components/admin/data-table/data-table";
import { DataTableToolbar } from "@/components/admin/data-table/toolbar";
import { AdminPageHeader } from "@/components/admin/page-header";
import { Link } from "@/i18n/navigation";
import { requirePermission } from "@/lib/auth-guards";
import { CUSTOMER_SORTS, listCustomers, type CustomerSort } from "@/lib/services/customer.service";
import { formatDateTime } from "@/lib/utils/format";
import { formatINR } from "@/lib/utils/money";
import { formatIndianMobile } from "@/lib/utils/phone";
import { parseTableParams } from "@/lib/utils/table-params";

export async function generateMetadata() {
  const t = await getTranslations("Customers");
  return { title: t("title") };
}

export default async function CustomersPage({
  params,
  searchParams,
}: PageProps<"/[locale]/admin/customers">) {
  const { locale } = await params;
  setRequestLocale(locale as Locale);
  await requirePermission("customers:read", locale, `/${locale}/admin/customers`);
  const [t, tData] = await Promise.all([
    getTranslations("Customers"),
    getTranslations("DataTable"),
  ]);
  const tableParams = parseTableParams(await searchParams, {
    sortable: CUSTOMER_SORTS,
    defaultSort: "ltv",
  });
  const { rows, total } = await listCustomers({
    page: tableParams.page,
    pageSize: tableParams.pageSize,
    q: tableParams.q || undefined,
    sort: tableParams.sort as CustomerSort,
  });

  type Row = (typeof rows)[number];
  const columns: Column<Row>[] = [
    {
      key: "name",
      header: t("customer"),
      sortKey: "joined",
      cell: (r) => (
        <Link href={`/admin/customers/${r.id}`} className="font-medium hover:underline">
          {r.name || t("noName")}
          <span className="block text-xs font-normal text-muted-foreground">
            {r.phone ? formatIndianMobile(r.phone) : r.email}
          </span>
        </Link>
      ),
    },
    {
      key: "orders",
      header: t("orders"),
      sortKey: "orders",
      className: "text-right",
      cell: (r) => r.orders,
    },
    {
      key: "ltv",
      header: t("ltv"),
      sortKey: "ltv",
      className: "text-right",
      cell: (r) => formatINR(r.ltv, locale),
    },
    {
      key: "lastOrder",
      header: t("lastOrder"),
      sortKey: "lastOrder",
      hideOnMobile: true,
      cell: (r) => (r.lastOrderAt ? formatDateTime(r.lastOrderAt, locale) : "—"),
    },
  ];

  return (
    <>
      <AdminPageHeader
        title={t("title")}
        description={t("description")}
        breadcrumbs={[{ label: t("title") }]}
      />
      <div className="grid gap-4">
        <DataTableToolbar searchPlaceholder={t("searchPlaceholder")} filters={[]} />
        <DataTable
          pathname="/admin/customers"
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
