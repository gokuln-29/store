import { notFound } from "next/navigation";
import type { Locale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { SectionForm } from "@/components/admin/content/section-form";
import { AdminPageHeader } from "@/components/admin/page-header";
import { requirePermission } from "@/lib/auth-guards";
import { listCategoryTree } from "@/lib/services/category.service";
import { listBanners } from "@/lib/services/content.service";
import { newSectionInput } from "@/lib/utils/content-view";
import { firstParam } from "@/lib/utils/search-params";
import { SECTION_TYPES, type SectionType } from "@/lib/validators/content";

export default async function NewSectionPage({
  params,
  searchParams,
}: PageProps<"/[locale]/admin/content/new">) {
  const { locale } = await params;
  setRequestLocale(locale as Locale);
  await requirePermission("content:manage", locale);
  const type = firstParam((await searchParams).type);
  if (!type || !(SECTION_TYPES as readonly string[]).includes(type)) notFound();
  const t = await getTranslations("Content");
  const [banners, categories] = await Promise.all([listBanners(), listCategoryTree()]);
  const typeLabel = t(`type${type as SectionType}`);

  return (
    <>
      <AdminPageHeader
        title={t("newTitle", { type: typeLabel })}
        breadcrumbs={[{ label: t("title"), href: "/admin/content" }, { label: typeLabel }]}
      />
      <SectionForm
        id={null}
        defaults={newSectionInput(type as SectionType)}
        banners={banners.map((b) => ({ id: b.id, label: b.title }))}
        categories={categories.map((c) => ({ id: c.id, label: c.name, depth: c.depth }))}
      />
    </>
  );
}
