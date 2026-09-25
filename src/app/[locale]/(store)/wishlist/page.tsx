import type { Metadata } from "next";
import { notFound } from "next/navigation";
import type { Locale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { WishlistView } from "@/components/store/wishlist/wishlist-view";
import { getFeatures } from "@/lib/services/settings.service";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Wishlist");
  return { title: t("title"), robots: { index: false } };
}

export default async function WishlistPage({ params }: PageProps<"/[locale]/wishlist">) {
  setRequestLocale((await params).locale as Locale);
  if (!(await getFeatures()).wishlist) notFound();
  const t = await getTranslations("Wishlist");
  return (
    <div className="container mx-auto grid gap-6 px-4 py-8">
      <h1 className="text-2xl font-bold sm:text-3xl">{t("title")}</h1>
      <WishlistView />
    </div>
  );
}
