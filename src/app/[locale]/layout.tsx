import type { Metadata, Viewport } from "next";
import { Noto_Sans, Noto_Sans_Kannada, Noto_Sans_Tamil } from "next/font/google";
import { storeFontVariables } from "@/lib/fonts/store-fonts";
import { storeFontStyle } from "@/components/shared/store-shell";
import { notFound } from "next/navigation";
import { hasLocale, NextIntlClientProvider } from "next-intl";
import { getMessages, getTranslations, setRequestLocale } from "next-intl/server";
import { PwaProvider } from "@/components/pwa/pwa-provider";
import { Toaster } from "@/components/ui/sonner";
import { pickNamespaces, STORE_CLIENT_NAMESPACES } from "@/i18n/client-namespaces";
import { routing } from "@/i18n/routing";
import { getStoreSettings } from "@/lib/services/settings.service";
import { localize } from "@/lib/utils/localized";
import { iconVersion } from "@/lib/pwa/icon-meta";
import { shortName } from "@/lib/pwa/manifest";
import { siteUrl } from "@/lib/seo";
import "@/styles/globals.css";

// Not preloaded: stores usually pick their own font (Settings → Branding), and a preload would
// compete with the hero image. The browser still fetches it wherever it is used.
const notoSans = Noto_Sans({
  subsets: ["latin"],
  variable: "--font-noto-sans",
  display: "swap",
  preload: false,
});
// Tamil/Kannada fonts are not preloaded: their @font-face unicode-range makes the browser
// fetch them only on pages that actually contain those scripts.
const notoTamil = Noto_Sans_Tamil({
  subsets: ["tamil"],
  variable: "--font-noto-tamil",
  display: "swap",
  preload: false,
});
const notoKannada = Noto_Sans_Kannada({
  subsets: ["kannada"],
  variable: "--font-noto-kannada",
  display: "swap",
  preload: false,
});

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({ params }: LayoutProps<"/[locale]">): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) return {};
  const [t, settings] = await Promise.all([getTranslations({ locale }), getStoreSettings()]);
  const storeName = settings.name;
  return {
    metadataBase: new URL(siteUrl()),
    title: { default: storeName, template: `%s | ${storeName}` },
    description:
      localize(settings.tagline, locale, settings.defaultLocale) || t("Metadata.description"),
    icons: {
      // Without an uploaded favicon, use the icon generated from the logo.
      icon: settings.faviconUrl ?? `/icons/icon-192.png?v=${iconVersion(settings)}`,
      apple: `/icons/apple-touch-icon.png?v=${iconVersion(settings)}`,
    },
    appleWebApp: { capable: true, title: shortName(storeName), statusBarStyle: "default" },
  };
}

export async function generateViewport(): Promise<Viewport> {
  const settings = await getStoreSettings();
  return { themeColor: settings.primaryColor };
}

/** The service worker runs in production builds (or when explicitly enabled for testing). */
const serviceWorkerEnabled =
  process.env.NODE_ENV === "production" || process.env.NEXT_PUBLIC_ENABLE_SW === "true";

export default async function LocaleLayout({ children, params }: LayoutProps<"/[locale]">) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "Common" });
  // Only what storefront client components need (the admin panel adds the rest).
  const messages = pickNamespaces(await getMessages(), STORE_CLIENT_NAMESPACES);
  const settings = await getStoreSettings();

  return (
    <html
      lang={locale}
      className={`${notoSans.variable} ${notoTamil.variable} ${notoKannada.variable} ${storeFontVariables}`}
      style={storeFontStyle(settings)}
      suppressHydrationWarning
    >
      <body className="flex min-h-dvh flex-col bg-background font-[family-name:var(--store-font-body)] text-foreground antialiased">
        <NextIntlClientProvider messages={messages}>
          <a
            href="#main"
            className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-md focus:bg-primary focus:px-4 focus:py-2 focus:text-primary-foreground"
          >
            {t("skipToContent")}
          </a>
          <PwaProvider enabled={serviceWorkerEnabled}>
            {children}
            <Toaster richColors closeButton position="top-center" />
          </PwaProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
