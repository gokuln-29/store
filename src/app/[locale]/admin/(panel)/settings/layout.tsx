import type { Locale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { AdminPageHeader } from "@/components/admin/page-header";
import { SettingsNav } from "@/components/admin/settings/settings-nav";
import { requirePermission } from "@/lib/auth-guards";

export default async function SettingsLayout({
  children,
  params,
}: LayoutProps<"/[locale]/admin/settings">) {
  const { locale } = await params;
  setRequestLocale(locale as Locale);
  await requirePermission("settings:manage", locale, `/${locale}/admin/settings`);
  const t = await getTranslations("Settings");

  return (
    <>
      <AdminPageHeader title={t("title")} breadcrumbs={[{ label: t("title") }]} />
      <SettingsNav />
      <div className="pt-6">{children}</div>
    </>
  );
}
