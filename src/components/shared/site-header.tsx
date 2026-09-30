import { Search, User } from "lucide-react";
import Image from "next/image";
import { getLocale, getTranslations } from "next-intl/server";
import { LocaleSwitcher } from "@/components/shared/locale-switcher";
import { MobileNav, type NavLink } from "@/components/shared/mobile-nav";
import { CartLink } from "@/components/store/cart/cart-link";
import { WishlistLink } from "@/components/store/wishlist/wishlist-link";
import { HeaderSearch } from "@/components/store/header-search";
import { Link } from "@/i18n/navigation";
import { getCategoryTree } from "@/lib/services/catalog-query.service";
import { getStoreSettings } from "@/lib/services/settings.service";
import { storeLogoSrc } from "@/lib/pwa/icon-meta";
import { localize } from "@/lib/utils/localized";

const MAX_HEADER_CATEGORIES = 5;

export async function SiteHeader() {
  const [t, settings, tree, locale] = await Promise.all([
    getTranslations("Header"),
    getStoreSettings(),
    getCategoryTree(),
    getLocale(),
  ]);

  const categoryLinks: NavLink[] = tree.map((c) => ({
    href: `/c/${c.slug}`,
    label: localize(c.name, locale),
  }));
  const mobileLinks: NavLink[] = [
    { href: "/", label: t("home") },
    { href: "/shop", label: t("shop") },
    ...categoryLinks,
    { href: "/account", label: t("account") },
  ];

  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-background/90 backdrop-blur-xl supports-[backdrop-filter]:bg-background/70">
      <div className="container mx-auto flex h-16 items-center gap-3 px-4 sm:h-[72px]">
        <MobileNav links={mobileLinks} />
        <Link
          href="/"
          className="flex shrink-0 items-center gap-2.5 text-lg font-bold tracking-tight"
        >
          {settings.logoUrl ? (
            <>
              <Image
                src={storeLogoSrc(settings)}
                alt=""
                width={48}
                height={48}
                className="size-10 object-contain sm:size-12"
                priority
                // Already a small, sized copy of the logo.
                unoptimized
              />
              {/* The name sits next to the logo; on small screens only screen readers get it. */}
              <span className="sr-only font-heading text-xl sm:not-sr-only">{settings.name}</span>
            </>
          ) : (
            <span className="font-heading">{settings.name}</span>
          )}
        </Link>

        <nav aria-label={t("primaryNav")} className="ml-4 hidden lg:block">
          <ul className="flex items-center gap-6 text-sm font-medium">
            <li>
              <Link href="/shop" className="transition-colors hover:text-primary">
                {t("shop")}
              </Link>
            </li>
            {categoryLinks.slice(0, MAX_HEADER_CATEGORIES).map((link) => (
              <li key={link.href}>
                <Link href={link.href} className="transition-colors hover:text-primary">
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <HeaderSearch className="ml-auto hidden w-full max-w-sm md:block" />

        <div className="ml-auto flex items-center gap-1 md:ml-2">
          <Link
            href="/search"
            aria-label={t("search")}
            className="rounded-md p-2 hover:bg-accent md:hidden"
          >
            <Search className="size-5" aria-hidden />
          </Link>
          <LocaleSwitcher supported={settings.supportedLocales} />
          <Link
            href="/account"
            aria-label={t("account")}
            className="hidden rounded-md p-2 hover:bg-accent md:inline-flex"
          >
            <User className="size-5" aria-hidden />
          </Link>
          <WishlistLink />
          <CartLink />
        </div>
      </div>
    </header>
  );
}
