import type { Locale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { FeatureSettingsForm } from "@/components/admin/settings/features-form";
import { resolveFeatures } from "@/lib/features";
import { requirePermission } from "@/lib/auth-guards";
import { getStoreSettingsFresh } from "@/lib/services/settings.service";

export async function generateMetadata() {
  const t = await getTranslations("Settings");
  return { title: `${t("features")} · ${t("title")}` };
}

export default async function FeatureSettingsPage({
  params,
}: PageProps<"/[locale]/admin/settings/features">) {
  const { locale } = await params;
  setRequestLocale(locale as Locale);
  await requirePermission("settings:manage", locale);
  const settings = await getStoreSettingsFresh();
  return <FeatureSettingsForm defaults={resolveFeatures(settings.features)} />;
}
