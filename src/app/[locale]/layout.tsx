import type { Metadata } from "next";
import { Noto_Sans, Noto_Sans_Kannada, Noto_Sans_Tamil } from "next/font/google";
import { notFound } from "next/navigation";
import { hasLocale, NextIntlClientProvider } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Toaster } from "@/components/ui/sonner";
import { routing } from "@/i18n/routing";
import { getStoreSettings } from "@/lib/services/settings.service";
import { localize } from "@/lib/utils/localized";
import "@/styles/globals.css";

const notoSans = Noto_Sans({ subsets: ["latin"], variable: "--font-noto-sans", display: "swap" });
const notoTamil = Noto_Sans_Tamil({
  subsets: ["tamil"],
  variable: "--font-noto-tamil",
  display: "swap",
});
const notoKannada = Noto_Sans_Kannada({
  subsets: ["kannada"],
  variable: "--font-noto-kannada",
  display: "swap",
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
    title: { default: storeName, template: `%s | ${storeName}` },
    description:
      localize(settings.tagline, locale, settings.defaultLocale) || t("Metadata.description"),
    ...(settings.faviconUrl ? { icons: { icon: settings.faviconUrl } } : {}),
  };
}

export default async function LocaleLayout({ children, params }: LayoutProps<"/[locale]">) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "Common" });

  return (
    <html
      lang={locale}
      className={`${notoSans.variable} ${notoTamil.variable} ${notoKannada.variable}`}
      suppressHydrationWarning
    >
      <body className="flex min-h-dvh flex-col bg-background font-sans text-foreground antialiased">
        <NextIntlClientProvider>
          <a
            href="#main"
            className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-md focus:bg-primary focus:px-4 focus:py-2 focus:text-primary-foreground"
          >
            {t("skipToContent")}
          </a>
          {children}
          <Toaster richColors closeButton position="top-center" />
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
