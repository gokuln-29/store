import type { Metadata } from "next";
import { notFound } from "next/navigation";
import type { Locale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { StoreBreadcrumbs } from "@/components/store/breadcrumbs";
import { JsonLd } from "@/components/store/json-ld";
import { ProductCard } from "@/components/store/product-card";
import { ProductGallery } from "@/components/store/product/gallery";
import { PurchasePanel, type PanelOption } from "@/components/store/product/purchase-panel";
import { ScrollRow } from "@/components/store/scroll-row";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  getRelatedProducts,
  getStoreCategory,
  getStoreProduct,
} from "@/lib/services/catalog-query.service";
import { getStoreSettings } from "@/lib/services/settings.service";
import { localeAlternates, siteUrl, toPlainText } from "@/lib/seo";
import { localize } from "@/lib/utils/localized";
import { sanitizeRichText } from "@/lib/utils/sanitize";

// Product pages are rendered on first request and cached; catalog changes revalidate them.
export const revalidate = 3600;
export function generateStaticParams() {
  return [];
}

type Choice = { value: string; label: unknown };

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/p/[slug]">): Promise<Metadata> {
  const { locale, slug } = await params;
  const [product, settings] = await Promise.all([getStoreProduct(slug), getStoreSettings()]);
  if (!product) return {};
  const name = localize(product.name, locale);
  const description =
    localize(product.metaDescription, locale) ||
    localize(product.shortDescription, locale) ||
    toPlainText(localize(product.description, locale));
  const image = product.images[0]?.url;
  return {
    title: localize(product.metaTitle, locale) || name,
    description: description || undefined,
    alternates: localeAlternates(
      `/p/${slug}`,
      locale,
      settings.supportedLocales,
      settings.defaultLocale,
    ),
    openGraph: {
      type: "website",
      title: name,
      description: description || undefined,
      images: image ? [image] : undefined,
    },
  };
}

export default async function ProductPage({ params }: PageProps<"/[locale]/p/[slug]">) {
  const { locale, slug } = await params;
  setRequestLocale(locale as Locale);
  const product = await getStoreProduct(slug);
  if (!product) notFound();

  const [t, settings, category, related] = await Promise.all([
    getTranslations("Product"),
    getStoreSettings(),
    getStoreCategory(product.category.slug),
    getRelatedProducts(product.id, product.categoryId),
  ]);
  const name = localize(product.name, locale);
  const shortDescription = localize(product.shortDescription, locale);
  const description = localize(product.description, locale);

  const options: PanelOption[] = (
    (product.options as { key: string; label: unknown; values: Choice[] }[]) ?? []
  ).map((o) => ({
    key: o.key,
    label: localize(o.label, locale),
    values: o.values.map((v) => ({ value: v.value, label: localize(v.label, locale) || v.value })),
  }));

  // Specifications: attribute values with their localized labels, in category order.
  const values = (product.attributes ?? {}) as Record<string, string | number>;
  const specs = product.category.attributes.flatMap((attr) => {
    const raw = values[attr.key];
    if (raw === undefined || raw === "") return [];
    const choice = ((attr.options as Choice[] | null) ?? []).find((o) => o.value === String(raw));
    const shown = choice
      ? localize(choice.label, locale) || String(raw)
      : `${raw}${attr.unit ? ` ${attr.unit}` : ""}`;
    return [
      {
        key: attr.key,
        label: localize(attr.label, locale),
        value: shown,
        color: attr.type === "COLOR" ? String(raw) : null,
      },
    ];
  });
  if (product.brand)
    specs.unshift({ key: "brand", label: t("brand"), value: product.brand, color: null });

  const url = `${siteUrl()}/${locale}/p/${slug}`;
  const prices = product.variants.map((v) => v.price);
  const inStock = product.variants.some((v) => v.stock > 0);
  const availability = `https://schema.org/${inStock ? "InStock" : "OutOfStock"}`;

  return (
    <div className="container mx-auto grid grid-cols-1 gap-10 px-4 py-6">
      <StoreBreadcrumbs
        items={[
          ...(category?.ancestors ?? []).map((a) => ({
            label: localize(a.name, locale),
            href: `/c/${a.slug}`,
          })),
          { label: localize(product.category.name, locale), href: `/c/${product.category.slug}` },
          { label: name },
        ]}
        locale={locale}
      />

      <div className="grid gap-8 md:grid-cols-2 lg:gap-12">
        <ProductGallery
          images={product.images.map((i) => ({ url: i.url, alt: localize(i.alt, locale) }))}
          name={name}
        />
        <div className="grid content-start gap-5">
          <div className="grid gap-2">
            {product.brand && (
              <p className="text-sm font-medium tracking-wide text-muted-foreground uppercase">
                {product.brand}
              </p>
            )}
            <h1 className="text-2xl font-bold sm:text-3xl">{name}</h1>
            {shortDescription && <p className="text-muted-foreground">{shortDescription}</p>}
          </div>
          <PurchasePanel
            variants={product.variants.map((v) => ({
              id: v.id,
              sku: v.sku,
              optionValues: (v.optionValues as Record<string, string>) ?? {},
              price: v.price,
              compareAtPrice: v.compareAtPrice,
              stock: v.stock,
            }))}
            options={options}
            pricesIncludeTax={settings.pricesIncludeTax}
          />
        </div>
      </div>

      {(description || specs.length > 0) && (
        <Tabs defaultValue={description ? "description" : "specs"} className="max-w-3xl">
          <TabsList>
            {description && <TabsTrigger value="description">{t("description")}</TabsTrigger>}
            {specs.length > 0 && <TabsTrigger value="specs">{t("specifications")}</TabsTrigger>}
          </TabsList>
          {description && (
            <TabsContent value="description" className="pt-4">
              <div
                className="rich-text"
                dangerouslySetInnerHTML={{ __html: sanitizeRichText(description) }}
              />
            </TabsContent>
          )}
          {specs.length > 0 && (
            <TabsContent value="specs" className="pt-4">
              <dl className="grid divide-y rounded-lg border text-sm">
                {specs.map((s) => (
                  <div key={s.key} className="grid grid-cols-[40%_1fr] gap-4 px-4 py-2.5">
                    <dt className="text-muted-foreground">{s.label}</dt>
                    <dd className="flex items-center gap-2 font-medium">
                      {s.color && (
                        <span
                          className="size-4 rounded-full border"
                          style={{ background: s.color }}
                          aria-hidden
                        />
                      )}
                      {s.value}
                    </dd>
                  </div>
                ))}
              </dl>
            </TabsContent>
          )}
        </Tabs>
      )}

      {related.length > 0 && (
        <section className="grid gap-4">
          <h2 className="text-xl font-bold">{t("related")}</h2>
          <ScrollRow label={t("related")}>
            {related.map((p) => (
              <li key={p.id} className="w-[45%] shrink-0 snap-start sm:w-[30%] lg:w-[22%]">
                <ProductCard product={p} />
              </li>
            ))}
          </ScrollRow>
        </section>
      )}

      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "Product",
          name,
          sku: product.variants[0]!.sku,
          url,
          image: product.images.map((i) => new URL(i.url, siteUrl()).toString()),
          description: toPlainText(description || shortDescription, 500) || undefined,
          ...(product.brand ? { brand: { "@type": "Brand", name: product.brand } } : {}),
          offers:
            product.variants.length === 1
              ? {
                  "@type": "Offer",
                  price: (prices[0]! / 100).toFixed(2),
                  priceCurrency: "INR",
                  availability,
                  url,
                }
              : {
                  "@type": "AggregateOffer",
                  lowPrice: (Math.min(...prices) / 100).toFixed(2),
                  highPrice: (Math.max(...prices) / 100).toFixed(2),
                  offerCount: product.variants.length,
                  priceCurrency: "INR",
                  availability,
                },
        }}
      />
    </div>
  );
}
