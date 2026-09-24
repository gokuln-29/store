import { MapPin, Plus } from "lucide-react";
import type { Metadata } from "next";
import type { Locale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { AddressCardActions } from "@/components/account/address-card-actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Link } from "@/i18n/navigation";
import { requireUser } from "@/lib/auth-guards";
import { listAddresses, MAX_ADDRESSES_PER_USER } from "@/lib/services/address.service";
import { formatIndianMobile } from "@/lib/utils/phone";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Addresses");
  return { title: t("title"), robots: { index: false } };
}

export default async function AddressesPage({ params }: PageProps<"/[locale]/account/addresses">) {
  const { locale } = await params;
  setRequestLocale(locale as Locale);
  const user = await requireUser(locale, `/${locale}/account/addresses`);
  const t = await getTranslations("Addresses");
  const addresses = await listAddresses(user.id);

  return (
    <section aria-labelledby="addresses-heading" className="grid gap-4">
      <div className="flex items-center justify-between gap-4">
        <h2 id="addresses-heading" className="text-lg font-semibold">
          {t("title")}
        </h2>
        {addresses.length > 0 && addresses.length < MAX_ADDRESSES_PER_USER && (
          <Button asChild size="sm">
            <Link href="/account/addresses/new">
              <Plus className="size-4" aria-hidden />
              {t("add")}
            </Link>
          </Button>
        )}
      </div>

      {addresses.length === 0 ? (
        <div className="flex flex-col items-center rounded-lg border border-dashed px-4 py-12 text-center">
          <MapPin className="size-8 text-muted-foreground" aria-hidden />
          <p className="mt-3 font-medium">{t("empty")}</p>
          <p className="mt-1 text-sm text-muted-foreground">{t("emptyHint")}</p>
          <Button asChild className="mt-6">
            <Link href="/account/addresses/new">
              <Plus className="size-4" aria-hidden />
              {t("add")}
            </Link>
          </Button>
        </div>
      ) : (
        <ul className="grid gap-4 lg:grid-cols-2">
          {addresses.map((address) => (
            <li key={address.id}>
              <Card className="h-full">
                <CardContent className="grid gap-3">
                  <div className="flex items-center gap-2">
                    <p className="font-medium">{address.name}</p>
                    {address.label && (
                      <span className="rounded bg-muted px-2 py-0.5 text-xs">{address.label}</span>
                    )}
                    {address.isDefault && (
                      <span className="rounded bg-primary px-2 py-0.5 text-xs text-primary-foreground">
                        {t("default")}
                      </span>
                    )}
                  </div>
                  <address className="text-sm leading-relaxed text-muted-foreground not-italic">
                    {address.line1}
                    {address.line2 && <>, {address.line2}</>}
                    <br />
                    {address.landmark && (
                      <>
                        {address.landmark}
                        <br />
                      </>
                    )}
                    {address.city}, {address.state} {address.pincode}
                    <br />
                    {formatIndianMobile(address.phone)}
                  </address>
                  <AddressCardActions id={address.id} isDefault={address.isDefault} />
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
