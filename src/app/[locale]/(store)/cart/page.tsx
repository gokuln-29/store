import type { Metadata } from "next";
import type { Locale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { CartView } from "@/components/store/cart/cart-view";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Cart");
  return { title: t("title"), robots: { index: false } };
}

export default async function CartPage({ params }: PageProps<"/[locale]/cart">) {
  const { locale } = await params;
  setRequestLocale(locale as Locale);
  const t = await getTranslations("Cart");
  return (
    <div className="container mx-auto grid grid-cols-1 gap-6 px-4 py-6">
      <h1 className="text-2xl font-bold sm:text-3xl">{t("title")}</h1>
      <CartView />
    </div>
  );
}
