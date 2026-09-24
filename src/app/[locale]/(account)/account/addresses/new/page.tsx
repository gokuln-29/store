import type { Metadata } from "next";
import type { Locale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { AddressForm } from "@/components/account/address-form";
import { requireUser } from "@/lib/auth-guards";
import { getProfile } from "@/lib/services/user.service";
import { EMPTY_ADDRESS } from "@/lib/validators/auth";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Addresses");
  return { title: t("newTitle"), robots: { index: false } };
}

export default async function NewAddressPage({
  params,
}: PageProps<"/[locale]/account/addresses/new">) {
  const { locale } = await params;
  setRequestLocale(locale as Locale);
  const user = await requireUser(locale, `/${locale}/account/addresses/new`);
  const t = await getTranslations("Addresses");
  const profile = await getProfile(user.id);

  return (
    <section aria-labelledby="address-heading" className="grid gap-4">
      <h2 id="address-heading" className="text-lg font-semibold">
        {t("newTitle")}
      </h2>
      <AddressForm
        id={null}
        defaults={{
          ...EMPTY_ADDRESS,
          name: profile?.name ?? "",
          phone: profile?.phone?.replace(/^\+91/, "") ?? "",
        }}
      />
    </section>
  );
}
