import type { Metadata } from "next";
import type { Locale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { OtpLoginForm } from "@/components/auth/otp-login-form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { firstParam } from "@/lib/utils/search-params";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("CustomerLogin");
  return { title: t("title"), robots: { index: false, follow: true } };
}

export default async function CustomerLoginPage({
  params,
  searchParams,
}: PageProps<"/[locale]/login">) {
  const { locale } = await params;
  setRequestLocale(locale as Locale);
  const t = await getTranslations("CustomerLogin");
  const callbackUrl = firstParam((await searchParams).callbackUrl);

  return (
    <section className="container mx-auto flex justify-center px-4 py-12 sm:py-16">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="text-xl">
            <h1>{t("title")}</h1>
          </CardTitle>
          <CardDescription>{t("subtitle")}</CardDescription>
        </CardHeader>
        <CardContent>
          <OtpLoginForm callbackUrl={callbackUrl} />
        </CardContent>
      </Card>
    </section>
  );
}
