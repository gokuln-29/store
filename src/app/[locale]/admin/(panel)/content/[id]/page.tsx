import { notFound } from "next/navigation";
import type { Locale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { SectionForm } from "@/components/admin/content/section-form";
import { AdminPageHeader } from "@/components/admin/page-header";
import { requirePermission } from "@/lib/auth-guards";
import { listCategoryTree } from "@/lib/services/category.service";
import { getSection, listBanners } from "@/lib/services/content.service";
import { sectionToFormInput } from "@/lib/utils/content-view";
import type { SectionType } from "@/lib/validators/content";

export default async function EditSectionPage({
  params,
}: PageProps<"/[locale]/admin/content/[id]">) {
  const { locale, id } = await params;
  setRequestLocale(locale as Locale);
  await requirePermission("content:manage", locale);
  const t = await getTranslations("Content");
  const [section, banners, categories] = await Promise.all([
    getSection(id),
    listBanners(),
    listCategoryTree(),
  ]);
  if (!section) notFound();
  const typeLabel = t(`type${section.type as SectionType}`);

  return (
    <>
      <AdminPageHeader
        title={t("editTitle", { type: typeLabel })}
        breadcrumbs={[{ label: t("title"), href: "/admin/content" }, { label: typeLabel }]}
      />
      <SectionForm
        id={section.id}
        defaults={sectionToFormInput(section)}
        banners={banners.map((b) => ({ id: b.id, label: b.title }))}
        categories={categories.map((c) => ({ id: c.id, label: c.name, depth: c.depth }))}
      />
    </>
  );
}
