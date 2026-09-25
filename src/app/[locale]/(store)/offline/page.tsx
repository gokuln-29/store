import { WifiOff } from "lucide-react";
import type { Metadata } from "next";
import type { Locale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { RetryButton } from "@/components/pwa/retry-button";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Pwa");
  return { title: t("offlineTitle"), robots: { index: false } };
}

/**
 * Shown by the service worker when a page isn't available offline. Precached at install
 * for every language, so it must not depend on the visitor.
 */
export default async function OfflinePage({ params }: PageProps<"/[locale]/offline">) {
  setRequestLocale((await params).locale as Locale);
  const t = await getTranslations("Pwa");
  return (
    <div className="container mx-auto flex max-w-md flex-col items-center gap-4 px-4 py-20 text-center">
      <WifiOff className="size-12 text-muted-foreground" aria-hidden />
      <h1 className="text-2xl font-bold">{t("offlineTitle")}</h1>
      <p className="text-muted-foreground">{t("offlineBody")}</p>
      <div className="flex flex-wrap justify-center gap-2">
        <RetryButton />
        <Button asChild variant="outline">
          <Link href="/cart">{t("viewCart")}</Link>
        </Button>
      </div>
    </div>
  );
}
