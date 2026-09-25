import { BadgeCheck } from "lucide-react";
import Image from "next/image";
import type { Locale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import type { ReviewStatus } from "@/generated/prisma/client";
import { DataTable, type Column } from "@/components/admin/data-table/data-table";
import { DataTableToolbar } from "@/components/admin/data-table/toolbar";
import { AdminPageHeader } from "@/components/admin/page-header";
import { ReviewActions } from "@/components/admin/reviews/review-actions";
import { RatingStars } from "@/components/store/reviews/rating-stars";
import { Badge } from "@/components/ui/badge";
import { Link } from "@/i18n/navigation";
import { requirePermission } from "@/lib/auth-guards";
import { listReviewsAdmin } from "@/lib/services/review.service";
import { getFeatures } from "@/lib/services/settings.service";
import { formatDateTime } from "@/lib/utils/format";
import { isLocalUpload } from "@/lib/utils/images";
import { localize } from "@/lib/utils/localized";
import { formatIndianMobile } from "@/lib/utils/phone";
import { parseTableParams } from "@/lib/utils/table-params";

const STATUSES = ["PENDING", "APPROVED", "REJECTED"] as const satisfies readonly ReviewStatus[];

export async function generateMetadata() {
  const t = await getTranslations("AdminReviews");
  return { title: t("title") };
}

export default async function AdminReviewsPage({
  params,
  searchParams,
}: PageProps<"/[locale]/admin/reviews">) {
  const { locale } = await params;
  setRequestLocale(locale as Locale);
  await requirePermission("catalog:write", locale, `/${locale}/admin/reviews`);
  const raw = await searchParams;
  const [t, tData, features] = await Promise.all([
    getTranslations("AdminReviews"),
    getTranslations("DataTable"),
    getFeatures(),
  ]);
  const tableParams = parseTableParams(raw, {
    sortable: ["createdAt"] as const,
    defaultSort: "createdAt",
    filters: { status: STATUSES },
  });
  const status = tableParams.filters.status as ReviewStatus | undefined;
  const { rows, total } = await listReviewsAdmin({
    page: tableParams.page,
    pageSize: tableParams.pageSize,
    status,
    q: tableParams.q || undefined,
  });

  type Row = (typeof rows)[number];
  const columns: Column<Row>[] = [
    {
      key: "review",
      header: t("review"),
      cell: (r) => (
        <div className="grid max-w-xl gap-1 text-sm">
          <Link href={`/admin/products/${r.product.id}`} className="font-medium hover:underline">
            {localize(r.product.name, locale)}
          </Link>
          <RatingStars value={r.rating} />
          {r.title && <p className="font-semibold">{r.title}</p>}
          {r.body && <p className="whitespace-pre-line text-muted-foreground">{r.body}</p>}
          {r.imageUrls.length > 0 && (
            <div className="flex gap-2">
              {r.imageUrls.map((url) => (
                <a key={url} href={url} target="_blank" rel="noopener noreferrer">
                  <Image
                    src={url}
                    alt={t("photo")}
                    width={56}
                    height={56}
                    className="size-14 rounded object-cover"
                    unoptimized={isLocalUpload(url)}
                  />
                </a>
              ))}
            </div>
          )}
          <p className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            {r.user.name || (r.user.phone ? formatIndianMobile(r.user.phone) : "")}
            {r.orderItemId && (
              <span className="inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-400">
                <BadgeCheck className="size-3.5" aria-hidden />
                {t("verified")}
              </span>
            )}
            <span>{formatDateTime(r.createdAt, locale)}</span>
          </p>
        </div>
      ),
    },
    {
      key: "status",
      header: t("status"),
      cell: (r) => (
        <Badge variant={r.status === "APPROVED" ? "default" : "secondary"}>
          {t(`statuses.${r.status}`)}
        </Badge>
      ),
    },
    {
      key: "actions",
      header: <span className="sr-only">{t("actions")}</span>,
      cell: (r) => <ReviewActions id={r.id} status={r.status} />,
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
        {!features.reviews && (
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
              key: "status",
              label: t("status"),
              allLabel: t("allStatuses"),
              options: STATUSES.map((s) => ({ value: s, label: t(`statuses.${s}`) })),
            },
          ]}
        />
        <DataTable
          pathname="/admin/reviews"
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
