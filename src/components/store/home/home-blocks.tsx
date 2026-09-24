import { Quote, Star } from "lucide-react";
import Image from "next/image";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import type { HomeBlock } from "@/lib/services/home.service";
import { isLocalUpload } from "@/lib/utils/images";
import { localize } from "@/lib/utils/localized";
import { sanitizeRichText } from "@/lib/utils/sanitize";
import { ProductCard } from "../product-card";
import { ScrollRow } from "../scroll-row";
import { HeroSlider } from "./hero-slider";

function SectionHeading({
  title,
  href,
  viewAll,
}: {
  title: string;
  href?: string | null;
  viewAll: string;
}) {
  if (!title) return null;
  return (
    <div className="mb-4 flex items-end justify-between gap-4">
      <h2 className="text-xl font-bold sm:text-2xl">{title}</h2>
      {href && (
        <Link href={href} className="text-sm font-medium text-primary hover:underline">
          {viewAll}
        </Link>
      )}
    </div>
  );
}

/** Renders the configured home page sections in order. */
export async function HomeBlocks({ blocks, locale }: { blocks: HomeBlock[]; locale: string }) {
  const t = await getTranslations("Home");
  let productRows = 0;

  return (
    <div className="grid grid-cols-1 gap-10 pb-12 sm:gap-14">
      {blocks.map((block) => {
        const title = localize(block.title, locale);
        switch (block.type) {
          case "OFFER_STRIP": {
            const message = localize(block.message, locale);
            return (
              <div
                key={block.id}
                className="-mb-6 bg-primary px-4 py-2 text-center text-sm font-medium text-primary-foreground sm:-mb-10"
              >
                {block.linkUrl ? (
                  <Link href={block.linkUrl} className="hover:underline">
                    {message}
                  </Link>
                ) : (
                  message
                )}
              </div>
            );
          }
          case "HERO_BANNER":
            return <HeroSlider key={block.id} banners={block.banners} />;
          case "FEATURED_CATEGORIES":
            return (
              <section key={block.id} className="container mx-auto px-4">
                <SectionHeading title={title} viewAll={t("viewAll")} />
                <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
                  {block.categories.map((c) => {
                    const name = localize(c.name, locale);
                    return (
                      <li key={c.id}>
                        {c.imageUrl ? (
                          <Link
                            href={`/c/${c.slug}`}
                            className="group relative flex aspect-[4/3] items-end overflow-hidden rounded-lg bg-muted"
                          >
                            <Image
                              src={c.imageUrl}
                              alt=""
                              fill
                              sizes="(min-width: 1024px) 25vw, 50vw"
                              className="object-cover transition-transform group-hover:scale-105"
                              unoptimized={isLocalUpload(c.imageUrl)}
                            />
                            <span className="relative m-3 rounded bg-background/90 px-3 py-1.5 text-sm font-semibold">
                              {name}
                            </span>
                          </Link>
                        ) : (
                          // No image: a tile in the store's brand colour with the name.
                          <Link
                            href={`/c/${c.slug}`}
                            className="flex aspect-[4/3] items-center justify-center rounded-lg bg-primary/10 p-4 text-center text-lg font-semibold text-foreground transition-colors hover:bg-primary/20"
                          >
                            {name}
                          </Link>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </section>
            );
          case "PRODUCT_CAROUSEL": {
            const isFirstRow = productRows++ === 0;
            return (
              <section key={block.id} className="container mx-auto px-4">
                <SectionHeading title={title} href={block.viewAllHref} viewAll={t("viewAll")} />
                <ScrollRow label={title}>
                  {block.products.map((p, i) => (
                    <li key={p.id} className="w-[45%] shrink-0 snap-start sm:w-[30%] lg:w-[22%]">
                      <ProductCard product={p} priority={isFirstRow && i < 2} />
                    </li>
                  ))}
                </ScrollRow>
              </section>
            );
          }
          case "TESTIMONIALS":
            return (
              <section key={block.id} className="bg-muted/50 py-10">
                <div className="container mx-auto px-4">
                  <SectionHeading title={title} viewAll={t("viewAll")} />
                  <ul className="grid gap-4 md:grid-cols-3">
                    {block.items.map((item, i) => (
                      <li key={i} className="grid gap-3 rounded-lg bg-background p-5 shadow-sm">
                        <Quote className="size-5 text-primary" aria-hidden />
                        <p className="text-sm leading-relaxed">{localize(item.quote, locale)}</p>
                        <div className="mt-auto flex items-center justify-between gap-2 text-sm">
                          <span className="font-medium">
                            {item.author}
                            {item.location && (
                              <span className="font-normal text-muted-foreground">
                                {" "}
                                · {item.location}
                              </span>
                            )}
                          </span>
                          <span
                            className="flex"
                            role="img"
                            aria-label={t("rating", { rating: item.rating })}
                          >
                            {Array.from({ length: 5 }, (_, s) => (
                              <Star
                                key={s}
                                className={
                                  s < item.rating
                                    ? "size-4 fill-amber-400 text-amber-400"
                                    : "size-4 text-muted-foreground/40"
                                }
                                aria-hidden
                              />
                            ))}
                          </span>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              </section>
            );
          case "RICH_TEXT": {
            const html = localize(block.html, locale);
            if (!html) return null;
            return (
              <section key={block.id} className="container mx-auto max-w-3xl px-4">
                {title && <h2 className="mb-4 text-xl font-bold sm:text-2xl">{title}</h2>}
                <div
                  className="rich-text"
                  dangerouslySetInnerHTML={{ __html: sanitizeRichText(html) }}
                />
              </section>
            );
          }
        }
      })}
    </div>
  );
}
