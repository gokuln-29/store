import { ShoppingCart, User } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { LocaleSwitcher } from "@/components/shared/locale-switcher";
import { MobileNav } from "@/components/shared/mobile-nav";
import { Link } from "@/i18n/navigation";

export async function SiteHeader() {
  const t = await getTranslations("Header");
  const tCommon = await getTranslations("Common");
  // TODO(phase-1): read store name and logo from StoreSettings.
  const storeName = tCommon("storeNamePlaceholder");

  const links = [
    { href: "/", label: t("home") },
    { href: "/account", label: t("account") },
  ] as const;

  return (
    <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <div className="container mx-auto flex h-16 items-center gap-4 px-4">
        <MobileNav links={links} />
        <Link href="/" className="text-lg font-bold tracking-tight">
          {storeName}
        </Link>

        <nav aria-label={t("primaryNav")} className="ml-6 hidden md:block">
          <ul className="flex items-center gap-6 text-sm font-medium">
            {links.map((link) => (
              <li key={link.href}>
                <Link href={link.href} className="transition-colors hover:text-primary">
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <div className="ml-auto flex items-center gap-2">
          <LocaleSwitcher />
          <Link
            href="/account"
            aria-label={t("account")}
            className="hidden rounded-md p-2 hover:bg-accent md:inline-flex"
          >
            <User className="size-5" aria-hidden />
          </Link>
          <Link href="/cart" aria-label={t("cart")} className="rounded-md p-2 hover:bg-accent">
            <ShoppingCart className="size-5" aria-hidden />
          </Link>
        </div>
      </div>
    </header>
  );
}
