import type { Locale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { GeneralSettingsForm } from "@/components/admin/settings/general-form";
import { requirePermission } from "@/lib/auth-guards";
import { getStoreSettingsFresh } from "@/lib/services/settings.service";
import { paiseToRupeeInput } from "@/lib/utils/money";
import type { GeneralSettingsInput } from "@/lib/validators/settings";

export async function generateMetadata() {
  const t = await getTranslations("Settings");
  return { title: `${t("general")} · ${t("title")}` };
}

export default async function GeneralSettingsPage({
  params,
}: PageProps<"/[locale]/admin/settings/general">) {
  const { locale } = await params;
  setRequestLocale(locale as Locale);
  await requirePermission("settings:manage", locale);
  const s = await getStoreSettingsFresh();

  const defaults: GeneralSettingsInput = {
    name: s.name,
    tagline: (s.tagline as Record<string, string> | null) ?? {},
    supportedLocales: s.supportedLocales as GeneralSettingsInput["supportedLocales"],
    defaultLocale: s.defaultLocale as GeneralSettingsInput["defaultLocale"],
    minOrderValue: paiseToRupeeInput(s.minOrderValue),
    orderNumberPrefix: s.orderNumberPrefix ?? "",
  };
  return <GeneralSettingsForm defaults={defaults} />;
}
