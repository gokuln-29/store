"use client";

import { MapPin, Package, User } from "lucide-react";
import { useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

const ITEMS = [
  { href: "/account", key: "profile", icon: User, exact: true },
  { href: "/account/orders", key: "orders", icon: Package, exact: false },
  { href: "/account/addresses", key: "addresses", icon: MapPin, exact: false },
] as const;

export function AccountNav() {
  const t = useTranslations("Account");
  const pathname = usePathname();

  return (
    <nav aria-label={t("navLabel")}>
      <ul className="flex gap-1 overflow-x-auto md:flex-col">
        {ITEMS.map(({ href, key, icon: Icon, exact }) => {
          const active = exact ? pathname === href : pathname.startsWith(href);
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium whitespace-nowrap hover:bg-accent",
                  active && "bg-accent",
                )}
              >
                <Icon className="size-4" aria-hidden />
                {t(key)}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
