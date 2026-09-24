import type { Locale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { AccountNav } from "@/components/account/account-nav";
import { LogoutButton } from "@/components/shared/logout-button";
import { requireUser } from "@/lib/auth-guards";

export default async function AccountLayout({
  children,
  params,
}: LayoutProps<"/[locale]/account">) {
  const { locale } = await params;
  setRequestLocale(locale as Locale);
  await requireUser(locale, `/${locale}/account`);
  const t = await getTranslations("Account");

  return (
    <div className="container mx-auto px-4 py-8 sm:py-12">
      <div className="mb-6 flex items-center justify-between gap-4">
        <h1 className="text-2xl font-bold">{t("title")}</h1>
        <LogoutButton area="store" variant="outline" />
      </div>
      <div className="grid gap-6 md:grid-cols-[200px_1fr]">
        <aside>
          <AccountNav />
        </aside>
        <div className="min-w-0">{children}</div>
      </div>
    </div>
  );
}
