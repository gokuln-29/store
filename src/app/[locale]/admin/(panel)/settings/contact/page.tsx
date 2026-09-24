import type { Locale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { ContactSettingsForm } from "@/components/admin/settings/contact-form";
import { requirePermission } from "@/lib/auth-guards";
import { getStoreSettingsFresh } from "@/lib/services/settings.service";
import type { ContactSettingsInput } from "@/lib/validators/settings";

export async function generateMetadata() {
  const t = await getTranslations("Settings");
  return { title: `${t("contact")} · ${t("title")}` };
}

export default async function ContactSettingsPage({
  params,
}: PageProps<"/[locale]/admin/settings/contact">) {
  const { locale } = await params;
  setRequestLocale(locale as Locale);
  await requirePermission("settings:manage", locale);
  const s = await getStoreSettingsFresh();
  const address = (s.businessAddress ?? {}) as Record<string, string | undefined>;
  const social = (s.socialLinks ?? {}) as Record<string, string | undefined>;

  const defaults: ContactSettingsInput = {
    contactEmail: s.contactEmail ?? "",
    contactPhone: s.contactPhone ?? "",
    whatsappNumber: s.whatsappNumber?.replace(/^\+91/, "") ?? "",
    address: {
      line1: address.line1 ?? "",
      line2: address.line2 ?? "",
      city: address.city ?? "",
      stateCode: (address.stateCode ?? "") as ContactSettingsInput["address"]["stateCode"],
      pincode: address.pincode ?? "",
    },
    socialLinks: {
      instagram: social.instagram ?? "",
      facebook: social.facebook ?? "",
      youtube: social.youtube ?? "",
      x: social.x ?? "",
    },
  };
  return <ContactSettingsForm defaults={defaults} />;
}
