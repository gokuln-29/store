import { Download } from "lucide-react";
import type { Locale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { ProductImport } from "@/components/admin/catalog/product-import";
import { AdminPageHeader } from "@/components/admin/page-header";
import { Button } from "@/components/ui/button";
import { requirePermission } from "@/lib/auth-guards";

export async function generateMetadata() {
  const t = await getTranslations("Import");
  return { title: t("title") };
}

export default async function ProductImportPage({
  params,
}: PageProps<"/[locale]/admin/products/import">) {
  const { locale } = await params;
  setRequestLocale(locale as Locale);
  await requirePermission("catalog:write", locale);
  const [t, tProducts] = await Promise.all([
    getTranslations("Import"),
    getTranslations("Products"),
  ]);

  return (
    <>
      <AdminPageHeader
        title={t("title")}
        description={t("description")}
        breadcrumbs={[
          { label: tProducts("title"), href: "/admin/products" },
          { label: t("title") },
        ]}
        actions={
          <>
            <Button asChild variant="outline" size="sm">
              <a href="/api/admin/products/export?template=1" download>
                <Download className="size-4" aria-hidden />
                {t("template")}
              </a>
            </Button>
            <Button asChild variant="outline" size="sm">
              <a href="/api/admin/products/export" download>
                <Download className="size-4" aria-hidden />
                {t("export")}
              </a>
            </Button>
          </>
        }
      />
      <div className="grid gap-6">
        <div className="rounded-lg border bg-background p-4 text-sm">
          <p className="font-medium">{t("howTitle")}</p>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-muted-foreground">
            <li>{t("how1")}</li>
            <li>{t("how2")}</li>
            <li>{t("how3")}</li>
            <li>{t("how4")}</li>
          </ul>
        </div>
        <ProductImport />
      </div>
    </>
  );
}
