import type { Locale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { PaymentSettingsForm } from "@/components/admin/settings/payments-form";
import { requirePermission } from "@/lib/auth-guards";
import { getStoreSettingsFresh } from "@/lib/services/settings.service";
import { paiseToRupeeInput } from "@/lib/utils/money";

export async function generateMetadata() {
  const t = await getTranslations("Settings");
  return { title: `${t("payments")} · ${t("title")}` };
}

export default async function PaymentSettingsPage({
  params,
}: PageProps<"/[locale]/admin/settings/payments">) {
  const { locale } = await params;
  setRequestLocale(locale as Locale);
  await requirePermission("settings:manage", locale);
  const s = await getStoreSettingsFresh();
  return (
    <PaymentSettingsForm
      defaults={{
        onlinePaymentsEnabled: s.onlinePaymentsEnabled,
        codEnabled: s.codEnabled,
        codFee: paiseToRupeeInput(s.codFee),
        codMinOrderValue: paiseToRupeeInput(s.codMinOrderValue),
        codMaxOrderValue: paiseToRupeeInput(s.codMaxOrderValue),
        pendingOrderTtlMinutes: String(s.pendingOrderTtlMinutes),
      }}
    />
  );
}
