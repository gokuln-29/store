import type { Locale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { BrandingSettingsForm } from "@/components/admin/settings/branding-form";
import { requirePermission } from "@/lib/auth-guards";
import { STORE_FONT_NAMES, type StoreFontName } from "@/lib/constants/fonts";
import { getStoreSettingsFresh } from "@/lib/services/settings.service";

export async function generateMetadata() {
  const t = await getTranslations("Settings");
  return { title: `${t("branding")} · ${t("title")}` };
}

const asFont = (name: string): StoreFontName =>
  (STORE_FONT_NAMES as readonly string[]).includes(name) ? (name as StoreFontName) : "Noto Sans";

export default async function BrandingSettingsPage({
  params,
}: PageProps<"/[locale]/admin/settings/branding">) {
  const { locale } = await params;
  setRequestLocale(locale as Locale);
  await requirePermission("settings:manage", locale);
  const s = await getStoreSettingsFresh();
  return (
    <BrandingSettingsForm
      storeName={s.name}
      defaults={{
        logoUrl: s.logoUrl ?? "",
        faviconUrl: s.faviconUrl ?? "",
        primaryColor: s.primaryColor,
        secondaryColor: s.secondaryColor,
        headingFont: asFont(s.headingFont),
        bodyFont: asFont(s.bodyFont),
      }}
    />
  );
}
