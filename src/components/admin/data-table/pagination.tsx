import { ChevronLeft, ChevronRight } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { tableHref } from "@/lib/utils/table-params";
import { PageSizeSelect } from "./page-size-select";

export async function DataTablePagination({
  pathname,
  current,
  page,
  pageSize,
  total,
}: {
  pathname: string;
  current: Record<string, string | number | undefined>;
  page: number;
  pageSize: number;
  total: number;
}) {
  const t = await getTranslations("DataTable");
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(total, page * pageSize);

  return (
    <nav
      aria-label={t("pagination")}
      className="flex flex-wrap items-center justify-between gap-3 text-sm"
    >
      <p className="text-muted-foreground">{t("showing", { from, to, total })}</p>
      <div className="flex items-center gap-2">
        <PageSizeSelect value={pageSize} label={t("rowsPerPage")} />
        {page > 1 ? (
          <Button asChild variant="outline" size="icon" className="size-8">
            <Link
              href={tableHref(pathname, current, { page: page - 1 })}
              aria-label={t("previousPage")}
            >
              <ChevronLeft className="size-4" aria-hidden />
            </Link>
          </Button>
        ) : (
          <Button
            variant="outline"
            size="icon"
            className="size-8"
            disabled
            aria-label={t("previousPage")}
          >
            <ChevronLeft className="size-4" aria-hidden />
          </Button>
        )}
        <span className="tabular-nums">{t("pageOf", { page, pages })}</span>
        {page < pages ? (
          <Button asChild variant="outline" size="icon" className="size-8">
            <Link
              href={tableHref(pathname, current, { page: page + 1 })}
              aria-label={t("nextPage")}
            >
              <ChevronRight className="size-4" aria-hidden />
            </Link>
          </Button>
        ) : (
          <Button
            variant="outline"
            size="icon"
            className="size-8"
            disabled
            aria-label={t("nextPage")}
          >
            <ChevronRight className="size-4" aria-hidden />
          </Button>
        )}
      </div>
    </nav>
  );
}
