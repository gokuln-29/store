import { Mail, MapPin, MessageCircle, Phone } from "lucide-react";
import Image from "next/image";
import { getLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { getCategoryTree } from "@/lib/services/catalog-query.service";
import { getStoreSettings } from "@/lib/services/settings.service";
import { socialLinks, type SocialNetwork } from "@/lib/services/storefront.service";
import { storeLogoSrc } from "@/lib/pwa/icon-meta";
import { localize } from "@/lib/utils/localized";

const NETWORK_NAMES: Record<SocialNetwork, string> = {
  instagram: "Instagram",
  facebook: "Facebook",
  youtube: "YouTube",
  x: "X",
};

/** Simple brand marks (lucide no longer ships brand icons). */
function SocialIcon({ network }: { network: SocialNetwork }) {
  const common = { className: "size-4", viewBox: "0 0 24 24", "aria-hidden": true } as const;
  switch (network) {
    case "instagram":
      return (
        <svg {...common} fill="none" stroke="currentColor" strokeWidth={2}>
          <rect x="3" y="3" width="18" height="18" rx="5" />
          <circle cx="12" cy="12" r="4" />
          <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" />
        </svg>
      );
    case "facebook":
      return (
        <svg {...common} fill="currentColor">
          <path d="M14 8.5V6.8c0-.8.5-1 1-1h2.5V2h-3.4C10.6 2 10 4.6 10 6.3v2.2H7.5V12H10v10h4V12h3l.5-3.5H14z" />
        </svg>
      );
    case "youtube":
      return (
        <svg {...common} fill="currentColor">
          <path d="M23 7.2a3 3 0 0 0-2.1-2.1C19 4.6 12 4.6 12 4.6s-7 0-8.9.5A3 3 0 0 0 1 7.2 31 31 0 0 0 .5 12 31 31 0 0 0 1 16.8a3 3 0 0 0 2.1 2.1c1.9.5 8.9.5 8.9.5s7 0 8.9-.5a3 3 0 0 0 2.1-2.1 31 31 0 0 0 .5-4.8 31 31 0 0 0-.5-4.8zM9.8 15.1V8.9L15.5 12l-5.7 3.1z" />
        </svg>
      );
    case "x":
      return (
        <svg {...common} fill="currentColor">
          <path d="M17.8 2h3.4l-7.4 8.5L22.5 22h-6.8l-5.3-7-6.1 7H.9l7.9-9L.5 2h7l4.8 6.4L17.8 2zm-1.2 18h1.9L7.5 3.9h-2L16.6 20z" />
        </svg>
      );
  }
}

type Address = { line1?: string; line2?: string; city?: string; state?: string; pincode?: string };

function FooterHeading({ children }: { children: React.ReactNode }) {
  return <h2 className="mb-4 text-sm font-semibold tracking-wide text-white">{children}</h2>;
}

const linkClass = "text-sm text-white/65 transition-colors hover:text-white";

export async function SiteFooter() {
  const [t, settings, tree, locale] = await Promise.all([
    getTranslations("Footer"),
    getStoreSettings(),
    getCategoryTree(),
    getLocale(),
  ]);
  const tagline = localize(settings.tagline, locale);
  const socials = socialLinks(settings.socialLinks);
  const address = (settings.businessAddress ?? null) as Address | null;
  const addressLine = address
    ? [address.line1, address.line2, address.city, address.pincode].filter(Boolean).join(", ")
    : "";
  const payments = [
    ...(settings.onlinePaymentsEnabled ? [t("upi"), t("cards"), t("netbanking")] : []),
    ...(settings.codEnabled ? [t("cod")] : []),
  ];

  return (
    <footer className="mt-auto border-t border-white/10 ink-surface">
      <div className="container mx-auto grid grid-cols-2 gap-x-6 gap-y-10 px-4 py-14 lg:grid-cols-[1.4fr_1fr_1fr_1.2fr] lg:py-16">
        <div className="col-span-2 grid content-start gap-4 lg:col-span-1">
          <Link href="/" className="flex w-fit items-center gap-3">
            {settings.logoUrl && (
              <Image
                src={storeLogoSrc(settings)}
                alt=""
                width={48}
                height={48}
                className="size-12 rounded-xl bg-white/5 object-contain p-1"
                // Already a small, sized copy of the logo.
                unoptimized
              />
            )}
            <span className="font-heading text-xl font-bold">{settings.name}</span>
          </Link>
          {tagline && <p className="max-w-xs text-sm text-white/65">{tagline}</p>}
          {socials.length > 0 && (
            <ul className="flex gap-2">
              {socials.map(({ network, url }) => (
                <li key={network}>
                  <a
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={t("social", {
                      storeName: settings.name,
                      network: NETWORK_NAMES[network],
                    })}
                    className="grid size-9 place-items-center rounded-full border border-white/15 bg-white/5 text-white/80 transition-colors hover:bg-white hover:text-neutral-900"
                  >
                    <SocialIcon network={network} />
                  </a>
                </li>
              ))}
            </ul>
          )}
        </div>

        <nav aria-label={t("shop")}>
          <FooterHeading>{t("shop")}</FooterHeading>
          <ul className="grid gap-2.5">
            <li>
              <Link href="/shop" className={linkClass}>
                {t("allProducts")}
              </Link>
            </li>
            {tree.slice(0, 6).map((c) => (
              <li key={c.id}>
                <Link href={`/c/${c.slug}`} className={linkClass}>
                  {localize(c.name, locale)}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <nav aria-label={t("help")}>
          <FooterHeading>{t("help")}</FooterHeading>
          <ul className="grid gap-2.5">
            <li>
              <Link href="/account" className={linkClass}>
                {t("account")}
              </Link>
            </li>
            <li>
              <Link href="/account/orders" className={linkClass}>
                {t("orders")}
              </Link>
            </li>
            <li>
              <Link href="/wishlist" className={linkClass}>
                {t("wishlist")}
              </Link>
            </li>
            <li>
              <Link href="/cart" className={linkClass}>
                {t("cart")}
              </Link>
            </li>
          </ul>
        </nav>

        <div className="col-span-2 lg:col-span-1">
          <FooterHeading>{t("contact")}</FooterHeading>
          <ul className="grid gap-3 text-sm text-white/65">
            {settings.contactPhone && (
              <li className="flex items-center gap-2.5">
                <Phone className="size-4 shrink-0 text-[var(--brand-secondary)]" aria-hidden />
                <a href={`tel:${settings.contactPhone}`} className="hover:text-white">
                  {settings.contactPhone}
                </a>
              </li>
            )}
            {settings.whatsappNumber && (
              <li className="flex items-center gap-2.5">
                <MessageCircle
                  className="size-4 shrink-0 text-[var(--brand-secondary)]"
                  aria-hidden
                />
                <a
                  href={`https://wa.me/${settings.whatsappNumber.replace(/\D/g, "")}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-white"
                >
                  {t("whatsapp")}
                </a>
              </li>
            )}
            {settings.contactEmail && (
              <li className="flex items-center gap-2.5">
                <Mail className="size-4 shrink-0 text-[var(--brand-secondary)]" aria-hidden />
                <a href={`mailto:${settings.contactEmail}`} className="break-all hover:text-white">
                  {settings.contactEmail}
                </a>
              </li>
            )}
            {addressLine && (
              <li className="flex items-start gap-2.5">
                <MapPin
                  className="mt-0.5 size-4 shrink-0 text-[var(--brand-secondary)]"
                  aria-hidden
                />
                <span>{addressLine}</span>
              </li>
            )}
          </ul>
        </div>
      </div>

      <div className="border-t border-white/10">
        <div className="container mx-auto flex flex-col gap-4 px-4 py-6 text-xs text-white/55 md:flex-row md:items-center md:justify-between">
          <div className="grid gap-1">
            <p>{t("rights", { year: new Date().getFullYear(), storeName: settings.name })}</p>
            {settings.legalName && settings.gstNumber && (
              <p>{t("legal", { legalName: settings.legalName, gstin: settings.gstNumber })}</p>
            )}
          </div>
          {payments.length > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              <span>{t("weAccept")}</span>
              {payments.map((p) => (
                <span
                  key={p}
                  className="rounded-md border border-white/15 bg-white/5 px-2 py-1 font-medium text-white/80"
                >
                  {p}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    </footer>
  );
}
