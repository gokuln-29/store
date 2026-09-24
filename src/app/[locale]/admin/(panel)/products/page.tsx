import { ImageIcon, Package, Plus, TriangleAlert } from "lucide-react";
import Image from "next/image";
import type { Locale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { ProductBulkActions } from "@/components/admin/catalog/product-bulk-actions";
import { DataTable, type Column } from "@/components/admin/data-table/data-table";
import { SelectionProvider } from "@/components/admin/data-table/selection";
import { DataTableToolbar } from "@/components/admin/data-table/toolbar";
import { AdminPageHeader } from "@/components/admin/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { requirePermission } from "@/lib/auth-guards";
import { can } from "@/lib/permissions";
import { listCategoryTree } from "@/lib/services/category.service";
import { listProducts } from "@/lib/services/product.service";
import { localizedLabel } from "@/lib/utils/catalog-view";
import { formatDateTime } from "@/lib/utils/format";
import { formatINR } from "@/lib/utils/money";
import { parseTableParams } from "@/lib/utils/table-params";

export async function generateMetadata() {
  const t = await getTranslations("Products");
  return { title: t("title") };
}

const STATUSES = ["DRAFT", "PUBLISHED", "ARCHIVED"] as const;
const STATUS_VARIANT = { DRAFT: "secondary", PUBLISHED: "default", ARCHIVED: "outline" } as const;

export default async function ProductsPage({
  params,
  searchParams,
}: PageProps<"/[locale]/admin/products">) {
  const { locale } = await params;
  setRequestLocale(locale as Locale);
  const user = await requirePermission("catalog:read", locale, `/${locale}/admin/products`);
  const canWrite = can(user.role, "catalog:write");
  const [t, tData, categories] = await Promise.all([
    getTranslations("Products"),
    getTranslations("DataTable"),
    listCategoryTree(),
  ]);
  const tableParams = parseTableParams(await searchParams, {
    sortable: ["updatedAt", "createdAt", "status"] as const,
    defaultSort: "updatedAt",
    filters: { status: STATUSES, category: categories.map((c) => c.id) },
  });
  const { rows, total } = await listProducts({
    ...tableParams,
    q: tableParams.q || undefined,
    status: tableParams.filters.status as (typeof STATUSES)[number] | undefined,
    categoryId: tableParams.filters.category,
  });

  type Row = (typeof rows)[number];
  const price = (r: Row) =>
    r.minPrice == null
      ? "—"
      : r.minPrice === r.maxPrice
        ? formatINR(r.minPrice, locale)
        : `${formatINR(r.minPrice, locale)} – ${formatINR(r.maxPrice!, locale)}`;

  const columns: Column<Row>[] = [
    {
      key: "product",
      header: t("product"),
      cell: (r) => (
        <Link href={`/admin/products/${r.id}`} className="flex items-center gap-3 hover:underline">
          <span className="relative flex size-10 shrink-0 items-center justify-center overflow-hidden rounded bg-muted">
            {r.imageUrl ? (
              <Image
                src={r.imageUrl}
                alt=""
                fill
                sizes="40px"
                className="object-cover"
                unoptimized={r.imageUrl.startsWith("/uploads/")}
              />
            ) : (
              <ImageIcon className="size-4 text-muted-foreground" aria-hidden />
            )}
          </span>
          <span className="min-w-0">
            <span className="block truncate font-medium">{localizedLabel(r.name, locale)}</span>
            <span className="block text-xs text-muted-foreground">
              {t("variantsCount", { count: r.variantCount })}
            </span>
          </span>
        </Link>
      ),
    },
    {
      key: "category",
      header: t("category"),
      hideOnMobile: true,
      cell: (r) => localizedLabel(r.category.name, locale),
    },
    {
      key: "status",
      header: t("status"),
      sortKey: "status",
      cell: (r) => <Badge variant={STATUS_VARIANT[r.status]}>{t(`status${r.status}`)}</Badge>,
    },
    {
      key: "price",
      header: t("price"),
      hideOnMobile: true,
      cell: (r) => <span className="whitespace-nowrap tabular-nums">{price(r)}</span>,
    },
    {
      key: "stock",
      header: t("stock"),
      cell: (r) => (
        <span className="inline-flex items-center gap-1 tabular-nums">
          {r.totalStock}
          {r.lowStock && (
            <TriangleAlert className="size-4 text-amber-600" aria-label={t("lowStock")}>
              <title>{t("lowStock")}</title>
            </TriangleAlert>
          )}
        </span>
      ),
    },
    {
      key: "updatedAt",
      header: t("updated"),
      sortKey: "updatedAt",
      hideOnMobile: true,
      cell: (r) => (
        <span className="text-sm whitespace-nowrap text-muted-foreground">
          {formatDateTime(r.updatedAt, locale)}
        </span>
      ),
    },
  ];

  const table = (
    <DataTable
      pathname="/admin/products"
      rows={rows}
      total={total}
      columns={columns}
      params={tableParams}
      selectable={canWrite}
      caption={t("title")}
      empty={
        tableParams.q || Object.keys(tableParams.filters).length ? (
          <p className="text-muted-foreground">{tData("noResults")}</p>
        ) : (
          <div className="flex flex-col items-center">
            <Package className="size-8 text-muted-foreground" aria-hidden />
            <p className="mt-3 font-medium">{t("empty")}</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {categories.length ? t("emptyHint") : t("noCategories")}
            </p>
          </div>
        )
      }
    />
  );

  return (
    <>
      <AdminPageHeader
        title={t("title")}
        description={t("description")}
        breadcrumbs={[{ label: t("title") }]}
        actions={
          canWrite &&
          categories.length > 0 && (
            <Button asChild size="sm">
              <Link href="/admin/products/new">
                <Plus className="size-4" aria-hidden />
                {t("add")}
              </Link>
            </Button>
          )
        }
      />
      <div className="grid gap-4">
        <DataTableToolbar
          searchPlaceholder={t("searchPlaceholder")}
          filters={[
            {
              key: "status",
              label: t("status"),
              allLabel: t("allStatuses"),
              options: STATUSES.map((s) => ({ value: s, label: t(`status${s}`) })),
            },
            {
              key: "category",
              label: t("category"),
              allLabel: t("allCategories"),
              options: categories.map((c) => ({
                value: c.id,
                label: `${"— ".repeat(c.depth)}${localizedLabel(c.name, locale)}`,
              })),
            },
          ]}
        />
        {canWrite ? (
          <SelectionProvider>
            {table}
            <ProductBulkActions />
          </SelectionProvider>
        ) : (
          table
        )}
      </div>
    </>
  );
}
