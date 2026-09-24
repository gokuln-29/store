import type { Locale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { BannerForm } from "@/components/admin/content/banner-form";
import { AdminPageHeader } from "@/components/admin/page-header";
import { requirePermission } from "@/lib/auth-guards";

export default async function NewBannerPage({
  params,
}: PageProps<"/[locale]/admin/content/banners/new">) {
  const { locale } = await params;
  setRequestLocale(locale as Locale);
  await requirePermission("content:manage", locale);
  const [t, tContent] = await Promise.all([getTranslations("Banners"), getTranslations("Content")]);
  return (
    <>
      <AdminPageHeader
        title={t("newTitle")}
        breadcrumbs={[
          { label: tContent("title"), href: "/admin/content" },
          { label: t("title"), href: "/admin/content/banners" },
          { label: t("newTitle") },
        ]}
      />
      <BannerForm
        id={null}
        defaults={{
          title: {},
          subtitle: {},
          ctaLabel: {},
          imageUrl: "",
          mobileImageUrl: "",
          linkUrl: "",
          sortOrder: "0",
          isActive: true,
          startsAt: "",
          endsAt: "",
        }}
      />
    </>
  );
}
