"use client";

import { useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";
import type { Permission } from "@/lib/permissions";
import { cn } from "@/lib/utils";
import { ADMIN_NAV } from "./nav-config";

export function AdminSidebarNav({
  permissions,
  onNavigate,
}: {
  permissions: Permission[];
  onNavigate?: () => void;
}) {
  const t = useTranslations("AdminNav");
  const pathname = usePathname();
  const allowed = new Set(permissions);

  return (
    <nav aria-label={t("navLabel")} className="grid gap-4 p-3">
      {ADMIN_NAV.map((group, i) => {
        const items = group.items.filter((item) => allowed.has(item.permission));
        if (!items.length) return null;
        return (
          <ul key={i} className="grid gap-0.5">
            {items.map(({ href, key, icon: Icon, exact }) => {
              const active = exact
                ? pathname === href
                : pathname === href || pathname.startsWith(`${href}/`);
              return (
                <li key={href}>
                  <Link
                    href={href}
                    onClick={onNavigate}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-accent hover:text-foreground",
                      active && "bg-accent text-foreground",
                    )}
                  >
                    <Icon className="size-4 shrink-0" aria-hidden />
                    {t(key)}
                  </Link>
                </li>
              );
            })}
          </ul>
        );
      })}
    </nav>
  );
}
