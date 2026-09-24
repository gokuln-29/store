import Image from "next/image";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import type { ProductCard as Card } from "@/lib/services/catalog-query.service";
import { isLocalUpload } from "@/lib/utils/images";
import { localize } from "@/lib/utils/localized";
import { Price, discountPercent } from "./price";

export function ProductCard({ product, priority = false }: { product: Card; priority?: boolean }) {
  const locale = useLocale();
  const t = useTranslations("Product");
  const name = localize(product.name, locale);
  const off = discountPercent(product.price, product.compareAtPrice);

  return (
    <Link
      href={`/p/${product.slug}`}
      className="group flex h-full flex-col gap-2 rounded-lg focus-visible:outline-2"
    >
      <div className="relative aspect-square overflow-hidden rounded-lg bg-muted">
        {product.image ? (
          <Image
            src={product.image.url}
            alt={localize(product.image.alt, locale) || name}
            fill
            sizes="(min-width: 1280px) 20vw, (min-width: 768px) 30vw, 50vw"
            className="object-cover transition-transform duration-300 group-hover:scale-105"
            priority={priority}
            unoptimized={isLocalUpload(product.image.url)}
          />
        ) : null}
        {!product.inStock ? (
          <span className="absolute top-2 left-2 rounded bg-background/90 px-2 py-0.5 text-xs font-medium">
            {t("outOfStock")}
          </span>
        ) : off ? (
          <span className="absolute top-2 left-2 rounded bg-[var(--brand-secondary,#f59e0b)] px-2 py-0.5 text-xs font-semibold text-[var(--brand-secondary-foreground,#0a0a0a)]">
            {t("off", { percent: off })}
          </span>
        ) : null}
      </div>
      <div className="grid gap-1 px-0.5">
        <h3 className="line-clamp-2 text-sm leading-snug font-medium group-hover:underline">
          {name}
        </h3>
        <Price
          price={product.price}
          compareAtPrice={product.compareAtPrice}
          from={product.maxPrice > product.price}
          locale={locale}
        />
      </div>
    </Link>
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
          <ProductCard product={p} priority={i < priorityCount} />
        </li>
      ))}
    </ul>
  );
}

export function ProductCardSkeleton() {
  return (
    <div className="grid gap-2" aria-hidden>
      <div className="aspect-square animate-pulse rounded-lg bg-muted" />
      <div className="h-4 w-3/4 animate-pulse rounded bg-muted" />
      <div className="h-4 w-1/3 animate-pulse rounded bg-muted" />
    </div>
  );
}
