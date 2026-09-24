import type { Locale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { TaxSettingsForm } from "@/components/admin/settings/tax-form";
import { requirePermission } from "@/lib/auth-guards";
import { getStoreSettingsFresh } from "@/lib/services/settings.service";
import type { TaxSettingsInput } from "@/lib/validators/settings";

export async function generateMetadata() {
  const t = await getTranslations("Settings");
  return { title: `${t("tax")} · ${t("title")}` };
}

export default async function TaxSettingsPage({
  params,
}: PageProps<"/[locale]/admin/settings/tax">) {
  const { locale } = await params;
  setRequestLocale(locale as Locale);
  await requirePermission("settings:manage", locale);
  const s = await getStoreSettingsFresh();
  return (
    <TaxSettingsForm
      defaults={{
        legalName: s.legalName ?? "",
        gstNumber: s.gstNumber ?? "",
        stateCode: (s.stateCode ?? "") as TaxSettingsInput["stateCode"],
        pricesIncludeTax: s.pricesIncludeTax,
        defaultTaxRateBps: String(s.defaultTaxRateBps / 100),
      }}
    />
  );
}
