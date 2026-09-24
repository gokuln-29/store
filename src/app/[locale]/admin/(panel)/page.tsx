import type { Metadata } from "next";
import type { Locale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Link } from "@/i18n/navigation";
import { requirePermission } from "@/lib/auth-guards";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Admin");
  return { title: t("dashboardTitle"), robots: { index: false, follow: false } };
}

export default async function AdminDashboardPage({ params }: PageProps<"/[locale]/admin">) {
  const { locale } = await params;
  setRequestLocale(locale as Locale);
  const user = await requirePermission("admin:access", locale, `/${locale}/admin`);
  const t = await getTranslations("Admin");
  const tRoles = await getTranslations("Roles");

  return (
    <div className="grid gap-6">
      <div>
        <h1 className="text-2xl font-bold">{t("dashboardTitle")}</h1>
        <p className="mt-1 text-sm text-muted-foreground" data-testid="admin-identity">
          {t("signedInAs", { email: user.email ?? "", role: tRoles(user.role) })}
        </p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>{t("welcome", { name: user.name ?? user.email ?? "" })}</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4">
          <p className="text-muted-foreground">{t("comingSoon")}</p>
          <div>
            <Button asChild variant="outline">
              <Link href="/">{t("viewStore")}</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
