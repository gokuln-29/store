import type { Locale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { LocaleSwitcher } from "@/components/shared/locale-switcher";
import { LogoutButton } from "@/components/shared/logout-button";
import { Link } from "@/i18n/navigation";
import { requirePermission } from "@/lib/auth-guards";

/** Minimal admin shell. The full sidebar/topbar layout is built in Phase 3. */
export default async function AdminPanelLayout({
  children,
  params,
}: LayoutProps<"/[locale]/admin">) {
  const { locale } = await params;
  setRequestLocale(locale as Locale);
  await requirePermission("admin:access", locale, `/${locale}/admin`);
  const t = await getTranslations("Admin");
  const tCommon = await getTranslations("Common");

  return (
    <div className="flex min-h-dvh flex-col bg-muted/40">
      <header className="border-b bg-background">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-3 px-4">
          <Link href="/admin" className="font-semibold">
            {tCommon("storeNamePlaceholder")} · {t("panel")}
          </Link>
          <div className="ml-auto flex items-center gap-1">
            <LocaleSwitcher />
            <LogoutButton area="admin" />
          </div>
        </div>
      </header>
      <main id="main" className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">
        {children}
      </main>
    </div>
  );
}
