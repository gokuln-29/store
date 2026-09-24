import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import type { ReactNode } from "react";
import { getTranslations } from "next-intl/server";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import { tableHref, type TableParams } from "@/lib/utils/table-params";
import { DataTablePagination } from "./pagination";
import { SelectAllCheckbox, SelectRowCheckbox } from "./selection";

export type Column<Row> = {
  key: string;
  header: ReactNode;
  cell: (row: Row) => ReactNode;
  /** Set to make the column sortable by this field. */
  sortKey?: string;
  className?: string;
  /** Hide on small screens. */
  hideOnMobile?: boolean;
};

type DataTableProps<Row extends { id: string }> = {
  pathname: string;
  rows: Row[];
  total: number;
  columns: Column<Row>[];
  params: TableParams<string>;
  /** Renders row checkboxes; wrap the page in <SelectionProvider>. */
  selectable?: boolean;
  empty: ReactNode;
  caption: string;
};

/**
 * Server-rendered table. Sorting and pagination are plain links (work without JS);
 * search/filters and bulk selection are small client components around it.
 */
export async function DataTable<Row extends { id: string }>({
  pathname,
  rows,
  total,
  columns,
  params,
  selectable,
  empty,
  caption,
}: DataTableProps<Row>) {
  const t = await getTranslations("DataTable");
  const current = {
    q: params.q,
    sort: params.sort,
    dir: params.dir,
    pageSize: params.pageSize,
    page: params.page,
    ...params.filters,
  };

  if (rows.length === 0) {
    return (
      <div className="rounded-lg border border-dashed bg-background px-4 py-12 text-center">
        {empty}
      </div>
    );
  }

  return (
    <div className="grid gap-3">
      <div className="overflow-x-auto rounded-lg border bg-background">
        <Table>
          <caption className="sr-only">{caption}</caption>
          <TableHeader>
            <TableRow>
              {selectable && (
                <TableHead className="w-10">
                  <SelectAllCheckbox ids={rows.map((r) => r.id)} label={t("selectAll")} />
                </TableHead>
              )}
              {columns.map((col) => {
                const active = col.sortKey && params.sort === col.sortKey;
                const nextDir = active && params.dir === "asc" ? "desc" : "asc";
                const Icon = !active ? ArrowUpDown : params.dir === "asc" ? ArrowUp : ArrowDown;
                return (
                  <TableHead
                    key={col.key}
                    className={cn(col.className, col.hideOnMobile && "hidden md:table-cell")}
                    aria-sort={
                      active ? (params.dir === "asc" ? "ascending" : "descending") : undefined
                    }
                  >
                    {col.sortKey ? (
                      <Link
                        href={tableHref(pathname, current, {
                          sort: col.sortKey,
                          dir: nextDir,
                          page: 1,
                        })}
                        className="inline-flex items-center gap-1 hover:text-foreground"
                      >
                        {col.header}
                        <Icon className={cn("size-3.5", !active && "opacity-40")} aria-hidden />
                      </Link>
                    ) : (
                      col.header
                    )}
                  </TableHead>
                );
              })}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.id}>
                {selectable && (
                  <TableCell>
                    <SelectRowCheckbox id={row.id} label={t("selectRow")} />
                  </TableCell>
                )}
                {columns.map((col) => (
                  <TableCell
                    key={col.key}
                    className={cn(col.className, col.hideOnMobile && "hidden md:table-cell")}
                  >
                    {col.cell(row)}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <DataTablePagination
        pathname={pathname}
        current={current}
        page={params.page}
        pageSize={params.pageSize}
        total={total}
      />
    </div>
  );
}
