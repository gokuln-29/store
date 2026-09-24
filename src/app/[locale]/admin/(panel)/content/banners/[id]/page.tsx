import { notFound } from "next/navigation";
import type { Locale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { BannerForm } from "@/components/admin/content/banner-form";
import { AdminPageHeader } from "@/components/admin/page-header";
import { requirePermission } from "@/lib/auth-guards";
import { getBanner } from "@/lib/services/content.service";
import { toLocalizedInput } from "@/lib/utils/catalog-view";
import { toDateInput } from "@/lib/utils/content-view";

export default async function EditBannerPage({
  params,
}: PageProps<"/[locale]/admin/content/banners/[id]">) {
  const { locale, id } = await params;
  setRequestLocale(locale as Locale);
  await requirePermission("content:manage", locale);
  const [t, tContent, banner] = await Promise.all([
    getTranslations("Banners"),
    getTranslations("Content"),
    getBanner(id),
  ]);
  if (!banner) notFound();
  return (
    <>
      <AdminPageHeader
        title={t("editTitle")}
        breadcrumbs={[
          { label: tContent("title"), href: "/admin/content" },
          { label: t("title"), href: "/admin/content/banners" },
          { label: t("editTitle") },
        ]}
      />
      <BannerForm
        id={banner.id}
        defaults={{
          title: toLocalizedInput(banner.title),
          subtitle: toLocalizedInput(banner.subtitle),
          ctaLabel: toLocalizedInput(banner.ctaLabel),
          imageUrl: banner.imageUrl,
          mobileImageUrl: banner.mobileImageUrl ?? "",
          linkUrl: banner.linkUrl ?? "",
          sortOrder: String(banner.sortOrder),
          isActive: banner.isActive,
          startsAt: toDateInput(banner.startsAt),
          endsAt: toDateInput(banner.endsAt),
        }}
      />
    </>
  );
}
