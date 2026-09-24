import { FolderTree, Pencil, Plus } from "lucide-react";
import type { Locale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { DeleteCategoryButton } from "@/components/admin/catalog/delete-category-button";
import { AdminPageHeader } from "@/components/admin/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Link } from "@/i18n/navigation";
import { requirePermission } from "@/lib/auth-guards";
import { can } from "@/lib/permissions";
import { listCategoryTree } from "@/lib/services/category.service";
import { localizedLabel } from "@/lib/utils/catalog-view";

export async function generateMetadata() {
  const t = await getTranslations("Categories");
  return { title: t("title") };
}

export default async function CategoriesPage({ params }: PageProps<"/[locale]/admin/categories">) {
  const { locale } = await params;
  setRequestLocale(locale as Locale);
  const user = await requirePermission("catalog:read", locale, `/${locale}/admin/categories`);
  const canWrite = can(user.role, "catalog:write");
  const [t, tData] = await Promise.all([
    getTranslations("Categories"),
    getTranslations("DataTable"),
  ]);
  const categories = await listCategoryTree();

  return (
    <>
      <AdminPageHeader
        title={t("title")}
        description={t("description")}
        breadcrumbs={[{ label: t("title") }]}
        actions={
          canWrite && (
            <Button asChild size="sm">
              <Link href="/admin/categories/new">
                <Plus className="size-4" aria-hidden />
                {t("add")}
              </Link>
            </Button>
          )
        }
      />
      {categories.length === 0 ? (
        <div className="flex flex-col items-center rounded-lg border border-dashed bg-background px-4 py-12 text-center">
          <FolderTree className="size-8 text-muted-foreground" aria-hidden />
          <p className="mt-3 font-medium">{t("empty")}</p>
          <p className="mt-1 text-sm text-muted-foreground">{t("emptyHint")}</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border bg-background">
          <Table>
            <caption className="sr-only">{t("title")}</caption>
            <TableHeader>
              <TableRow>
                <TableHead>{t("name")}</TableHead>
                <TableHead className="text-right">{t("products")}</TableHead>
                <TableHead className="hidden text-right sm:table-cell">
                  {t("attributesCount")}
                </TableHead>
                <TableHead className="hidden md:table-cell">{t("status")}</TableHead>
                <TableHead className="w-24 text-right">
                  <span className="sr-only">{tData("actions")}</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {categories.map((c) => {
                const name = localizedLabel(c.name, locale);
                return (
                  <TableRow key={c.id}>
                    <TableCell>
                      <div
                        className="flex items-center gap-2"
                        style={{ paddingInlineStart: `${c.depth * 1.25}rem` }}
                      >
                        {c.depth > 0 && (
                          <span className="text-muted-foreground" aria-hidden>
                            └
                          </span>
                        )}
                        <div>
                          <div className="font-medium">{name}</div>
                          <div className="font-mono text-xs text-muted-foreground">/{c.slug}</div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{c.productCount}</TableCell>
                    <TableCell className="hidden text-right tabular-nums sm:table-cell">
                      {c.attributeCount}
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      {!c.isActive && <Badge variant="secondary">{t("hidden")}</Badge>}
                    </TableCell>
                    <TableCell className="text-right whitespace-nowrap">
                      {canWrite && (
                        <>
                          <Button asChild variant="ghost" size="icon">
                            <Link
                              href={`/admin/categories/${c.id}`}
                              aria-label={`${t("editTitle")}: ${name}`}
                            >
                              <Pencil className="size-4" aria-hidden />
                            </Link>
                          </Button>
                          <DeleteCategoryButton
                            id={c.id}
                            name={name}
                            disabled={c.productCount > 0 || c.childCount > 0}
                          />
                        </>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </>
  );
}
