import type { Metadata } from "next";
import type { Locale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { AdminLoginForm } from "@/components/auth/admin-login-form";
import { demoAdminCredentials, isDemoMode } from "@/lib/demo";
import { LocaleSwitcher } from "@/components/shared/locale-switcher";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Link } from "@/i18n/navigation";
import { firstParam } from "@/lib/utils/search-params";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("AdminLogin");
  return { title: t("title"), robots: { index: false, follow: false } };
}

export default async function AdminLoginPage({
  params,
  searchParams,
}: PageProps<"/[locale]/admin/login">) {
  const { locale } = await params;
  setRequestLocale(locale as Locale);
  const t = await getTranslations("AdminLogin");
  const query = await searchParams;
  const callbackUrl = firstParam(query.callbackUrl);
  const passwordChanged = firstParam(query.passwordChanged) === "1";
  const tPassword = await getTranslations("ChangePassword");

  return (
    <main
      id="main"
      className="flex min-h-dvh flex-col items-center justify-center bg-muted/40 px-4 py-12"
    >
      <div className="mb-4 flex w-full max-w-sm justify-end">
        <LocaleSwitcher />
      </div>
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="text-xl">
            <h1>{t("title")}</h1>
          </CardTitle>
          <CardDescription>{t("subtitle")}</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          {passwordChanged && (
            <Alert role="status">
              <AlertDescription>{tPassword("done")}</AlertDescription>
            </Alert>
          )}
          {isDemoMode() && (
            <Alert role="note">
              <AlertDescription>{t("demoHint", demoAdminCredentials())}</AlertDescription>
            </Alert>
          )}
          <AdminLoginForm callbackUrl={callbackUrl} />
        </CardContent>
      </Card>
      <Link
        href="/login"
        className="mt-6 text-sm text-muted-foreground underline-offset-4 hover:underline"
      >
        {t("customerLink")}
      </Link>
    </main>
  );
}
