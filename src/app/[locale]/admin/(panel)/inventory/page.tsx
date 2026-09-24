import type { Locale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { StockEditor } from "@/components/admin/catalog/stock-editor";
import { DataTable, type Column } from "@/components/admin/data-table/data-table";
import { DataTableToolbar } from "@/components/admin/data-table/toolbar";
import { AdminPageHeader } from "@/components/admin/page-header";
import { Link } from "@/i18n/navigation";
import { requirePermission } from "@/lib/auth-guards";
import { can } from "@/lib/permissions";
import { listInventory, type InventoryFilter } from "@/lib/services/inventory.service";
import { localize } from "@/lib/utils/localized";
import { parseTableParams } from "@/lib/utils/table-params";

export async function generateMetadata() {
  const t = await getTranslations("Inventory");
  return { title: t("title") };
}

type ProductOption = { key: string; values: { value: string; label: unknown }[] };

/** "M / Black" using the option value labels in the admin's language. */
function variantLabel(options: unknown, values: unknown, locale: string): string {
  const opts = (Array.isArray(options) ? options : []) as ProductOption[];
  const picked = (values ?? {}) as Record<string, string>;
  return opts
    .map((o) => {
      const value = picked[o.key];
      const label = o.values.find((v) => v.value === value)?.label;
      return value ? localize(label, locale) || value : null;
    })
    .filter(Boolean)
    .join(" / ");
}

export default async function InventoryPage({
  params,
  searchParams,
}: PageProps<"/[locale]/admin/inventory">) {
  const { locale } = await params;
  setRequestLocale(locale as Locale);
  const user = await requirePermission("catalog:read", locale, `/${locale}/admin/inventory`);
  const canWrite = can(user.role, "catalog:write");
  const t = await getTranslations("Inventory");
  const tableParams = parseTableParams(await searchParams, {
    sortable: ["stock", "sku", "updatedAt"] as const,
    defaultSort: "stock",
    defaultDir: "asc",
    filters: { stock: ["low", "out"] },
    defaultPageSize: 50,
  });
  const { rows, total } = await listInventory({
    ...tableParams,
    q: tableParams.q || undefined,
    filter: tableParams.filters.stock as InventoryFilter | undefined,
  });

  type Row = (typeof rows)[number];
  const columns: Column<Row>[] = [
    {
      key: "product",
      header: t("product"),
      cell: (r) => {
        const variant = variantLabel(r.product.options, r.optionValues, locale);
        return (
          <Link href={`/admin/products/${r.product.id}`} className="hover:underline">
            <span className="block font-medium">{localize(r.product.name, locale)}</span>
            {variant && <span className="block text-xs text-muted-foreground">{variant}</span>}
          </Link>
        );
      },
    },
    {
      key: "sku",
      header: t("sku"),
      sortKey: "sku",
      hideOnMobile: true,
      cell: (r) => <code className="text-xs">{r.sku}</code>,
    },
    {
      key: "stock",
      header: t("stock"),
      sortKey: "stock",
      cell: (r) => (
        <StockEditor
          id={r.id}
          initial={r.stock}
          threshold={r.lowStockThreshold}
          label={`${localize(r.product.name, locale)} ${r.sku}`}
          readOnly={!canWrite}
        />
      ),
    },
    {
      key: "threshold",
      header: t("threshold"),
      hideOnMobile: true,
      cell: (r) => (
        <span className="text-muted-foreground tabular-nums">{r.lowStockThreshold}</span>
      ),
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
        <DataTableToolbar
          searchPlaceholder={t("searchPlaceholder")}
          filters={[
            {
              key: "stock",
              label: t("stockFilter"),
              allLabel: t("all"),
              options: [
                { value: "low", label: t("low") },
                { value: "out", label: t("out") },
              ],
            },
          ]}
        />
        <DataTable
          pathname="/admin/inventory"
          rows={rows}
          total={total}
          columns={columns}
          params={tableParams}
          caption={t("title")}
          empty={
            <p className="text-muted-foreground">
              {tableParams.filters.stock === "low" ? t("allGood") : t("empty")}
            </p>
          }
        />
      </div>
    </>
  );
}
