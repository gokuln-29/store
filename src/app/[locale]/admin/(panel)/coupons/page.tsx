import { Plus } from "lucide-react";
import type { Locale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { CouponRowActions } from "@/components/admin/coupons/coupon-row-actions";
import { DataTable, type Column } from "@/components/admin/data-table/data-table";
import { DataTableToolbar } from "@/components/admin/data-table/toolbar";
import { AdminPageHeader } from "@/components/admin/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { requirePermission } from "@/lib/auth-guards";
import { couponState, listCoupons } from "@/lib/services/coupon.service";
import { getFeatures } from "@/lib/services/settings.service";
import { formatBps, formatINR } from "@/lib/utils/money";
import { parseTableParams } from "@/lib/utils/table-params";

export async function generateMetadata() {
  const t = await getTranslations("Coupons");
  return { title: t("title") };
}

export default async function CouponsPage({
  params,
  searchParams,
}: PageProps<"/[locale]/admin/coupons">) {
  const { locale } = await params;
  setRequestLocale(locale as Locale);
  await requirePermission("coupons:manage", locale, `/${locale}/admin/coupons`);
  const [t, tData, features] = await Promise.all([
    getTranslations("Coupons"),
    getTranslations("DataTable"),
    getFeatures(),
  ]);
  const tableParams = parseTableParams(await searchParams, {
    sortable: ["createdAt"] as const,
    defaultSort: "createdAt",
    filters: { state: ["active", "disabled"] },
  });
  const { rows, total } = await listCoupons({
    page: tableParams.page,
    pageSize: tableParams.pageSize,
    q: tableParams.q || undefined,
    state: tableParams.filters.state as "active" | "disabled" | undefined,
  });
  const money = (p: number) => formatINR(p, locale);

  type Row = (typeof rows)[number];
  const columns: Column<Row>[] = [
    {
      key: "code",
      header: t("code"),
      cell: (r) => (
        <Link href={`/admin/coupons/${r.id}`} className="font-mono font-medium hover:underline">
          {r.code}
        </Link>
      ),
    },
    {
      key: "value",
      header: t("discount"),
      cell: (r) => (r.type === "PERCENTAGE" ? formatBps(r.value) : money(r.value)),
    },
    {
      key: "uses",
      header: t("uses"),
      hideOnMobile: true,
      cell: (r) => (r.usageLimit ? `${r.stats.uses} / ${r.usageLimit}` : String(r.stats.uses)),
    },
    {
      key: "given",
      header: t("discountGiven"),
      hideOnMobile: true,
      className: "text-right",
      cell: (r) => money(r.stats.discount),
    },
    {
      key: "revenue",
      header: t("revenue"),
      hideOnMobile: true,
      className: "text-right",
      cell: (r) => money(r.stats.revenue),
    },
    {
      key: "state",
      header: t("status"),
      cell: (r) => {
        const state = couponState(r);
        return (
          <Badge variant={state === "active" ? "default" : "secondary"}>
            {t(`states.${state}`)}
          </Badge>
        );
      },
    },
    {
      key: "actions",
      header: <span className="sr-only">{t("actions")}</span>,
      cell: (r) => (
        <CouponRowActions
          id={r.id}
          isActive={r.isActive}
          deletable={r.usedCount === 0 && r.stats.uses === 0}
        />
      ),
    },
  ];

  return (
    <>
      <AdminPageHeader
        title={t("title")}
        description={t("description")}
        breadcrumbs={[{ label: t("title") }]}
        actions={
          <Button asChild>
            <Link href="/admin/coupons/new">
              <Plus aria-hidden />
              {t("new")}
            </Link>
          </Button>
        }
      />
      <div className="grid gap-4">
        {!features.coupons && (
          <p
            role="status"
            className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-100"
          >
            {t("featureOff")}
          </p>
        )}
        <DataTableToolbar
          searchPlaceholder={t("searchPlaceholder")}
          filters={[
            {
              key: "state",
              label: t("status"),
              allLabel: t("allStates"),
              options: [
                { value: "active", label: t("states.active") },
                { value: "disabled", label: t("states.disabled") },
              ],
            },
          ]}
        />
        <DataTable
          pathname="/admin/coupons"
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
