import type { Metadata } from "next";
import { notFound } from "next/navigation";
import type { Locale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { AddressForm } from "@/components/account/address-form";
import { requireUser } from "@/lib/auth-guards";
import { INDIAN_STATE_CODES } from "@/lib/constants/indian-states";
import { getAddress } from "@/lib/services/address.service";
import type { AddressInput } from "@/lib/validators/auth";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Addresses");
  return { title: t("editTitle"), robots: { index: false } };
}

export default async function EditAddressPage({
  params,
}: PageProps<"/[locale]/account/addresses/[id]/edit">) {
  const { locale, id } = await params;
  setRequestLocale(locale as Locale);
  const user = await requireUser(locale, `/${locale}/account/addresses`);
  const t = await getTranslations("Addresses");
  // Scoped to the user: another customer's address id returns 404.
  const address = await getAddress(user.id, id);
  if (!address) notFound();

  const stateCode = (INDIAN_STATE_CODES as readonly string[]).includes(address.stateCode)
    ? (address.stateCode as AddressInput["stateCode"])
    : ("" as AddressInput["stateCode"]);

  return (
    <section aria-labelledby="address-heading" className="grid gap-4">
      <h2 id="address-heading" className="text-lg font-semibold">
        {t("editTitle")}
      </h2>
      <AddressForm
        id={address.id}
        defaults={{
          label: address.label ?? "",
          name: address.name,
          phone: address.phone.replace(/^\+91/, ""),
          line1: address.line1,
          line2: address.line2 ?? "",
          landmark: address.landmark ?? "",
          city: address.city,
          stateCode,
          pincode: address.pincode,
          isDefault: address.isDefault,
        }}
      />
    </section>
  );
}
