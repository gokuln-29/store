import { notFound } from "next/navigation";
import type { Locale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { CategoryForm } from "@/components/admin/catalog/category-form";
import { AdminPageHeader } from "@/components/admin/page-header";
import { requirePermission } from "@/lib/auth-guards";
import { getCategory, listCategoryTree } from "@/lib/services/category.service";
import { categoryToFormInput, localizedLabel } from "@/lib/utils/catalog-view";

export async function generateMetadata() {
  const t = await getTranslations("Categories");
  return { title: t("editTitle") };
}

export default async function EditCategoryPage({
  params,
}: PageProps<"/[locale]/admin/categories/[id]">) {
  const { locale, id } = await params;
  setRequestLocale(locale as Locale);
  await requirePermission("catalog:write", locale);
  const t = await getTranslations("Categories");
  const [category, tree] = await Promise.all([getCategory(id), listCategoryTree()]);
  if (!category) notFound();

  // A category can't be moved under itself or its own descendants.
  const blocked = new Set([id]);
  for (const c of tree) if (c.parentId && blocked.has(c.parentId)) blocked.add(c.id);
  const name = localizedLabel(category.name, locale);

  return (
    <>
      <AdminPageHeader
        title={name}
        breadcrumbs={[{ label: t("title"), href: "/admin/categories" }, { label: name }]}
      />
      <CategoryForm
        id={category.id}
        existingKeys={Object.fromEntries(category.attributes.map((a) => [a.id, a.key]))}
        parents={tree
          .filter((c) => !blocked.has(c.id))
          .map((c) => ({ id: c.id, label: localizedLabel(c.name, locale), depth: c.depth }))}
        defaults={categoryToFormInput(category)}
      />
    </>
  );
}
