"use client";

import { useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

const SECTIONS = [
  "general",
  "branding",
  "contact",
  "tax",
  "payments",
  "shipping",
  "features",
] as const;

export function SettingsNav() {
  const t = useTranslations("Settings");
  const pathname = usePathname();
  return (
    <nav aria-label={t("sections")}>
      <ul className="flex gap-1 overflow-x-auto border-b">
        {SECTIONS.map((section) => {
          const href = `/admin/settings/${section}`;
          const active = pathname === href || pathname.startsWith(`${href}/`);
          return (
            <li key={section}>
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "-mb-px inline-block border-b-2 border-transparent px-3 py-2 text-sm font-medium whitespace-nowrap text-muted-foreground hover:text-foreground",
                  active && "border-primary text-foreground",
                )}
              >
                {t(section)}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
