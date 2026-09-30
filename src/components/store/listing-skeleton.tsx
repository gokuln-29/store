import { ProductCardSkeleton } from "@/components/store/product-card";

/** Placeholder for product listing pages (shop, category, search) while they load. */
export function ListingSkeleton() {
  return (
    <div className="container mx-auto grid gap-6 px-4 py-6" aria-busy="true">
      <div className="h-4 w-40 animate-pulse rounded bg-muted" />
      <div className="h-8 w-64 animate-pulse rounded bg-muted" />
      <div className="grid gap-6 lg:grid-cols-[240px_1fr]">
        <div className="hidden gap-3 lg:grid">
          {Array.from({ length: 6 }, (_, i) => (
            <div key={i} className="h-4 animate-pulse rounded bg-muted" />
          ))}
        </div>
        <div className="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 lg:grid-cols-4">
          {Array.from({ length: 8 }, (_, i) => (
            <ProductCardSkeleton key={i} />
          ))}
        </div>
      </div>
    </div>
  );
}
