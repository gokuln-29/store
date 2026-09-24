import { Plus } from "lucide-react";
import type { Locale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { DataTable, type Column } from "@/components/admin/data-table/data-table";
import { DataTableToolbar } from "@/components/admin/data-table/toolbar";
import { AdminPageHeader } from "@/components/admin/page-header";
import { StaffRowActions } from "@/components/admin/staff/staff-row-actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { requirePermission } from "@/lib/auth-guards";
import { listStaff } from "@/lib/services/staff.service";
import { formatDateTime } from "@/lib/utils/format";
import { parseTableParams } from "@/lib/utils/table-params";

export async function generateMetadata() {
  const t = await getTranslations("Staff");
  return { title: t("title") };
}

const SORTABLE = ["name", "email", "createdAt", "lastLoginAt"] as const;

export default async function StaffPage({
  params,
  searchParams,
}: PageProps<"/[locale]/admin/staff">) {
  const { locale } = await params;
  setRequestLocale(locale as Locale);
  const me = await requirePermission("staff:manage", locale, `/${locale}/admin/staff`);
  const [t, tRoles, tData] = await Promise.all([
    getTranslations("Staff"),
    getTranslations("Roles"),
    getTranslations("DataTable"),
  ]);
  const tableParams = parseTableParams(await searchParams, {
    sortable: SORTABLE,
    defaultSort: "createdAt",
    defaultDir: "asc",
  });
  const { rows, total } = await listStaff({ ...tableParams, q: tableParams.q || undefined });

  type Row = (typeof rows)[number];
  const columns: Column<Row>[] = [
    {
      key: "name",
      header: t("name"),
      sortKey: "name",
      cell: (r) => (
        <div>
          <div className="font-medium">
            {r.name ?? "—"} {r.id === me.id && <Badge variant="outline">{t("you")}</Badge>}
          </div>
          <div className="text-xs text-muted-foreground md:hidden">{r.email}</div>
        </div>
      ),
    },
    {
      key: "email",
      header: t("email"),
      sortKey: "email",
      hideOnMobile: true,
      cell: (r) => r.email,
    },
    { key: "role", header: t("role"), cell: (r) => tRoles(r.role) },
    {
      key: "status",
      header: t("status"),
      cell: (r) =>
        r.isActive ? (
          <Badge variant="secondary">{t("active")}</Badge>
        ) : (
          <Badge variant="destructive">{t("inactive")}</Badge>
        ),
    },
    {
      key: "lastLoginAt",
      header: t("lastLogin"),
      sortKey: "lastLoginAt",
      hideOnMobile: true,
      cell: (r) => (r.lastLoginAt ? formatDateTime(r.lastLoginAt, locale) : t("never")),
    },
    {
      key: "actions",
      header: <span className="sr-only">{tData("actions")}</span>,
      className: "w-12 text-right",
      cell: (r) =>
        r.id === me.id ? null : (
          <StaffRowActions
            id={r.id}
            name={r.name ?? r.email ?? ""}
            role={r.role as "OWNER" | "STAFF"}
            isActive={r.isActive}
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
          <Button asChild size="sm">
            <Link href="/admin/staff/new">
              <Plus className="size-4" aria-hidden />
              {t("add")}
            </Link>
          </Button>
        }
      />
      <div className="grid gap-4">
        <DataTableToolbar searchPlaceholder={t("searchPlaceholder")} />
        <DataTable
          pathname="/admin/staff"
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
