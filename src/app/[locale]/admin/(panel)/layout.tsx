import type { Locale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { cookies } from "next/headers";
import {
  ADMIN_THEME_COOKIE,
  AdminThemeScope,
  type AdminTheme,
} from "@/components/admin/admin-theme";
import { AdminMobileNav } from "@/components/admin/admin-mobile-nav";
import { AdminSidebarNav } from "@/components/admin/admin-sidebar";
import { ThemeToggle } from "@/components/admin/theme-toggle";
import { AdminUserMenu } from "@/components/admin/user-menu";
import { LocaleSwitcher } from "@/components/shared/locale-switcher";
import { Link } from "@/i18n/navigation";
import { requirePermission } from "@/lib/auth-guards";
import { can, PERMISSIONS } from "@/lib/permissions";
import { getStoreSettings } from "@/lib/services/settings.service";

export default async function AdminPanelLayout({
  children,
  params,
}: LayoutProps<"/[locale]/admin">) {
  const { locale } = await params;
  setRequestLocale(locale as Locale);
  const user = await requirePermission("admin:access", locale, `/${locale}/admin`);
  const [t, tRoles, settings] = await Promise.all([
    getTranslations("Admin"),
    getTranslations("Roles"),
    getStoreSettings(),
  ]);
  const saved = (await cookies()).get(ADMIN_THEME_COOKIE)?.value;
  const theme: AdminTheme = saved === "dark" || saved === "light" ? saved : "system";
  const permissions = PERMISSIONS.filter((p) => can(user.role, p));
  const title = `${settings.name} · ${t("panel")}`;

  return (
    <AdminThemeScope initial={theme}>
      <div className="flex min-h-dvh bg-muted/40">
        <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 overflow-y-auto border-r bg-background md:block">
          <div className="flex h-14 items-center border-b px-4">
            <Link href="/admin" className="truncate font-semibold">
              {title}
            </Link>
          </div>
          <AdminSidebarNav permissions={permissions} />
        </aside>
        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b bg-background px-4">
            <AdminMobileNav permissions={permissions} title={title} />
            <span className="truncate font-semibold md:hidden">{settings.name}</span>
            <div className="ml-auto flex items-center gap-1">
              <LocaleSwitcher />
              <ThemeToggle />
              <AdminUserMenu
                name={user.name ?? user.email ?? ""}
                email={user.email ?? ""}
                roleLabel={tRoles(user.role)}
              />
            </div>
          </header>
          <main id="main" className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 md:px-8">
            {children}
          </main>
        </div>
      </div>
    </AdminThemeScope>
  );
}
