import type { Metadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";
import type { Locale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { StoreBreadcrumbs } from "@/components/store/breadcrumbs";
import { ProductListing } from "@/components/store/listing/product-listing";
import { Link } from "@/i18n/navigation";
import { getStoreCategory } from "@/lib/services/catalog-query.service";
import { PAGE_SIZE, loadListing } from "@/lib/services/listing-page";
import { getStoreSettings } from "@/lib/services/settings.service";
import { localeAlternates, toPlainText } from "@/lib/seo";
import { isLocalUpload } from "@/lib/utils/images";
import { localize } from "@/lib/utils/localized";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/c/[slug]">): Promise<Metadata> {
  const { locale, slug } = await params;
  const [category, settings] = await Promise.all([getStoreCategory(slug), getStoreSettings()]);
  if (!category) return {};
  const name = localize(category.name, locale);
  const description =
    localize(category.metaDescription, locale) ||
    toPlainText(localize(category.description, locale));
  return {
    title: localize(category.metaTitle, locale) || name,
    description: description || undefined,
    alternates: localeAlternates(
      `/c/${slug}`,
      locale,
      settings.supportedLocales,
      settings.defaultLocale,
    ),
    openGraph: category.imageUrl ? { images: [category.imageUrl] } : undefined,
  };
}

export default async function CategoryPage({
  params,
  searchParams,
}: PageProps<"/[locale]/c/[slug]">) {
  const { locale, slug } = await params;
  setRequestLocale(locale as Locale);
  const category = await getStoreCategory(slug);
  if (!category) notFound();
  const t = await getTranslations("Listing");
  const name = localize(category.name, locale);
  const description = localize(category.description, locale);
  const listing = await loadListing({
    raw: await searchParams,
    scope: { categoryIds: category.descendantIds },
    attributes: category.attributes,
    locale,
    defaultSort: "newest",
  });

  return (
    <div className="container mx-auto grid grid-cols-1 gap-6 px-4 py-6">
      <StoreBreadcrumbs
        items={[
          ...category.ancestors.map((a) => ({
            label: localize(a.name, locale),
            href: `/c/${a.slug}`,
          })),
          { label: name },
        ]}
        locale={locale}
      />
      <div className="flex items-center gap-4">
        {category.imageUrl && (
          <div className="relative hidden size-16 shrink-0 overflow-hidden rounded-lg bg-muted sm:block">
            <Image
              src={category.imageUrl}
              alt=""
              fill
              sizes="64px"
              className="object-cover"
              unoptimized={isLocalUpload(category.imageUrl)}
            />
          </div>
        )}
        <div>
          <h1 className="text-2xl font-bold sm:text-3xl">{name}</h1>
          {description && <p className="mt-1 max-w-2xl text-muted-foreground">{description}</p>}
        </div>
      </div>
      {category.children.length > 0 && (
        <nav aria-label={t("subcategories")}>
          <ul className="flex flex-wrap gap-2">
            {category.children.map((child) => (
              <li key={child.id}>
                <Link
                  href={`/c/${child.slug}`}
                  className="inline-block rounded-full border px-4 py-1.5 text-sm hover:bg-accent"
                >
                  {localize(child.name, locale)}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      )}
      <ProductListing
        basePath={`/c/${slug}`}
        {...listing}
        pageSize={PAGE_SIZE}
        attributes={category.attributes}
        locale={locale}
        sortOptions={["newest", "price_asc", "price_desc", "name"]}
        defaultSort="newest"
        emptyTitle={t("noProducts")}
        emptyHint={t("emptyCategory")}
      />
    </div>
  );
}
