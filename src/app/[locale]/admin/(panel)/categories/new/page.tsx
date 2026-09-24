import type { Locale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { CategoryForm } from "@/components/admin/catalog/category-form";
import { AdminPageHeader } from "@/components/admin/page-header";
import { requirePermission } from "@/lib/auth-guards";
import { listCategoryTree } from "@/lib/services/category.service";
import { localizedLabel } from "@/lib/utils/catalog-view";

export async function generateMetadata() {
  const t = await getTranslations("Categories");
  return { title: t("newTitle") };
}

export default async function NewCategoryPage({
  params,
}: PageProps<"/[locale]/admin/categories/new">) {
  const { locale } = await params;
  setRequestLocale(locale as Locale);
  await requirePermission("catalog:write", locale);
  const t = await getTranslations("Categories");
  const tree = await listCategoryTree();

  return (
    <>
      <AdminPageHeader
        title={t("newTitle")}
        breadcrumbs={[{ label: t("title"), href: "/admin/categories" }, { label: t("newTitle") }]}
      />
      <CategoryForm
        id={null}
        existingKeys={{}}
        parents={tree.map((c) => ({
          id: c.id,
          label: localizedLabel(c.name, locale),
          depth: c.depth,
        }))}
        defaults={{
          name: {},
          description: {},
          slug: "",
          parentId: "",
          imageUrl: "",
          sortOrder: "0",
          isActive: true,
          taxRateBps: "",
          hsnCode: "",
          metaTitle: {},
          metaDescription: {},
          attributes: [],
        }}
      />
    </>
  );
}
