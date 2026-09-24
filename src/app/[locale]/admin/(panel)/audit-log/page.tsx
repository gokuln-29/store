import type { Locale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { DataTable, type Column } from "@/components/admin/data-table/data-table";
import { DataTableToolbar } from "@/components/admin/data-table/toolbar";
import { AdminPageHeader } from "@/components/admin/page-header";
import { requirePermission } from "@/lib/auth-guards";
import { listAuditEntityTypes, listAuditLogs } from "@/lib/services/audit.service";
import { formatDateTime } from "@/lib/utils/format";
import { parseTableParams } from "@/lib/utils/table-params";

export async function generateMetadata() {
  const t = await getTranslations("Audit");
  return { title: t("title") };
}

function ChangesCell({ changes }: { changes: unknown }) {
  if (changes == null) return <span className="text-muted-foreground">—</span>;
  const json = JSON.stringify(changes, null, 2);
  return (
    <details className="max-w-md">
      <summary className="cursor-pointer text-sm text-primary">
        {Object.keys(changes as object).join(", ") || "…"}
      </summary>
      <pre className="mt-2 max-h-64 overflow-auto rounded bg-muted p-2 text-xs whitespace-pre-wrap">
        {json}
      </pre>
    </details>
  );
}

export default async function AuditLogPage({
  params,
  searchParams,
}: PageProps<"/[locale]/admin/audit-log">) {
  const { locale } = await params;
  setRequestLocale(locale as Locale);
  await requirePermission("reports:read", locale, `/${locale}/admin/audit-log`);
  const [t, tData, entityTypes] = await Promise.all([
    getTranslations("Audit"),
    getTranslations("DataTable"),
    listAuditEntityTypes(),
  ]);
  const tableParams = parseTableParams(await searchParams, {
    sortable: ["createdAt"] as const,
    defaultSort: "createdAt",
    filters: { entity: entityTypes },
  });
  const { rows, total } = await listAuditLogs({
    page: tableParams.page,
    pageSize: tableParams.pageSize,
    q: tableParams.q || undefined,
    entityType: tableParams.filters.entity,
  });

  type Row = (typeof rows)[number];
  const columns: Column<Row>[] = [
    {
      key: "when",
      header: t("when"),
      cell: (r) => <span className="whitespace-nowrap">{formatDateTime(r.createdAt, locale)}</span>,
    },
    { key: "who", header: t("who"), cell: (r) => r.actor?.name ?? r.actor?.email ?? t("system") },
    {
      key: "action",
      header: t("action"),
      cell: (r) => <code className="text-xs">{r.action}</code>,
    },
    {
      key: "entity",
      header: t("entity"),
      hideOnMobile: true,
      cell: (r) => (
        <span className="text-sm">
          {r.entityType}
          {r.entityId && (
            <span className="block truncate font-mono text-xs text-muted-foreground">
              {r.entityId}
            </span>
          )}
        </span>
      ),
    },
    {
      key: "changes",
      header: t("changes"),
      hideOnMobile: true,
      cell: (r) => <ChangesCell changes={r.changes} />,
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
              key: "entity",
              label: t("entity"),
              allLabel: t("allEntities"),
              options: entityTypes.map((e) => ({ value: e, label: e })),
            },
          ]}
        />
        <DataTable
          pathname="/admin/audit-log"
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
