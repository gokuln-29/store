import type { Metadata } from "next";
import type { Locale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { OtpLoginForm } from "@/components/auth/otp-login-form";
import { CheckoutForm } from "@/components/store/checkout/checkout-form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getCurrentUser } from "@/lib/auth-guards";
import { resolveFeatures } from "@/lib/features";
import { listAddresses } from "@/lib/services/address.service";
import { getStoreSettings } from "@/lib/services/settings.service";
import { getProfile } from "@/lib/services/user.service";
import { formatIndianMobile } from "@/lib/utils/phone";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Checkout");
  return { title: t("title"), robots: { index: false } };
}

export default async function CheckoutPage({ params }: PageProps<"/[locale]/checkout">) {
  const { locale } = await params;
  setRequestLocale(locale as Locale);
  const t = await getTranslations("Checkout");
  const user = await getCurrentUser();

  if (!user) {
    // Guests verify their mobile number right here; the cart (in the browser) is kept.
    return (
      <div className="container mx-auto flex justify-center px-4 py-10">
        <Card className="w-full max-w-sm">
          <CardHeader>
            <CardTitle className="text-xl">
              <h1>{t("loginTitle")}</h1>
            </CardTitle>
            <CardDescription>{t("loginHint")}</CardDescription>
          </CardHeader>
          <CardContent>
            <OtpLoginForm callbackUrl={`/${locale}/checkout`} />
          </CardContent>
        </Card>
      </div>
    );
  }

  const [profile, addresses, settings] = await Promise.all([
    getProfile(user.id),
    listAddresses(user.id),
    getStoreSettings(),
  ]);
  return (
    <div className="container mx-auto grid grid-cols-1 gap-6 px-4 py-6">
      <h1 className="text-2xl font-bold sm:text-3xl">{t("title")}</h1>
      <CheckoutForm
        addresses={addresses.map((a) => ({
          id: a.id,
          name: a.name,
          phone: a.phone,
          line1: a.line1,
          line2: a.line2,
          city: a.city,
          state: a.state,
          stateCode: a.stateCode,
          pincode: a.pincode,
          isDefault: a.isDefault,
        }))}
        phone={profile?.phone ? formatIndianMobile(profile.phone) : null}
        name={profile?.name ?? null}
        email={profile?.email ?? null}
        codFee={settings.codFee}
        couponsEnabled={resolveFeatures(settings.features).coupons}
      />
    </div>
  );
}
