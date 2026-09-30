import Image from "next/image";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import type { ProductCard as Card } from "@/lib/services/catalog-query.service";
import { isLocalUpload } from "@/lib/utils/images";
import { localize } from "@/lib/utils/localized";
import { Price, discountPercent } from "./price";
import { CardRating } from "./reviews/card-rating";
import { WishlistButton } from "./wishlist/wishlist-button";

/**
 * `headingLevel`: h2 in grids directly under the page title, h3 inside sections that have
 * their own h2 (carousels, "You may also like"), so headings never skip a level.
 */
export function ProductCard({
  product,
  priority = false,
  headingLevel = "h3",
}: {
  product: Card;
  priority?: boolean;
  headingLevel?: "h2" | "h3";
}) {
  const Heading = headingLevel;
  const locale = useLocale();
  const t = useTranslations("Product");
  const name = localize(product.name, locale);
  const off = discountPercent(product.price, product.compareAtPrice);

  return (
    <div className="group relative h-full">
      <Link
        href={`/p/${product.slug}`}
        className="flex h-full flex-col gap-3 rounded-2xl focus-visible:outline-2"
      >
        <div className="relative aspect-square overflow-hidden rounded-2xl bg-muted ring-1 ring-black/5 transition-shadow duration-300 group-hover:shadow-xl group-hover:shadow-primary/10">
          {product.image ? (
            <Image
              src={product.image.url}
              alt={localize(product.image.alt, locale) || name}
              fill
              sizes="(min-width: 1280px) 20vw, (min-width: 768px) 30vw, 50vw"
              className="object-cover transition-transform duration-500 group-hover:scale-105"
              priority={priority}
              unoptimized={isLocalUpload(product.image.url)}
            />
          ) : null}
          {!product.inStock ? (
            <span className="absolute top-3 left-3 rounded-full bg-background/90 px-2.5 py-1 text-xs font-medium shadow-sm backdrop-blur">
              {t("outOfStock")}
            </span>
          ) : off ? (
            <span className="absolute top-3 left-3 rounded-full bg-[var(--brand-secondary,#f59e0b)] px-2.5 py-1 text-xs font-semibold text-[var(--brand-secondary-foreground,#0a0a0a)] shadow-sm">
              {t("off", { percent: off })}
            </span>
          ) : null}
        </div>
        <div className="grid gap-1 px-1">
          <Heading className="line-clamp-2 text-sm leading-snug font-medium transition-colors group-hover:text-primary sm:text-[15px]">
            {name}
          </Heading>
          <CardRating rating={product.rating} />
          <Price
            price={product.price}
            compareAtPrice={product.compareAtPrice}
            from={product.maxPrice > product.price}
            locale={locale}
          />
        </div>
      </Link>
      {/* A sibling of the link: buttons can't be nested inside links. */}
      <WishlistButton productId={product.id} name={name} className="absolute top-3 right-3" />
    </div>
  );
}

export function ProductGrid({
  products,
  priorityCount = 0,
}: {
  products: Card[];
  priorityCount?: number;
}) {
  return (
    <ul className="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 lg:grid-cols-4">
      {products.map((p, i) => (
        <li key={p.id}>
          <ProductCard product={p} priority={i < priorityCount} headingLevel="h2" />
        </li>
      ))}
    </ul>
  );
}

export function ProductCardSkeleton() {
  return (
    <div className="grid gap-2" aria-hidden>
      <div className="aspect-square animate-pulse rounded-2xl bg-muted" />
      <div className="h-4 w-3/4 animate-pulse rounded bg-muted" />
      <div className="h-4 w-1/3 animate-pulse rounded bg-muted" />
    </div>
  );
}
