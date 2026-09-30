import { ArrowRight, Quote, Sparkles, Star } from "lucide-react";
import Image from "next/image";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import type { HomeBlock } from "@/lib/services/home.service";
import type { StoreHighlight } from "@/lib/services/storefront.service";
import { isLocalUpload } from "@/lib/utils/images";
import { localize } from "@/lib/utils/localized";
import { sanitizeRichText } from "@/lib/utils/sanitize";
import { ProductCard } from "../product-card";
import { ScrollRow } from "../scroll-row";
import { HeroSlider } from "./hero-slider";
import { StoreHighlights } from "./store-highlights";

function SectionHeading({
  title,
  href,
  viewAll,
  inverted = false,
}: {
  title: string;
  href?: string | null;
  viewAll: string;
  inverted?: boolean;
}) {
  if (!title) return null;
  return (
    <div className="mb-6 flex items-end justify-between gap-4 sm:mb-8">
      <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">{title}</h2>
      {href && (
        <Link
          href={href}
          className={
            inverted
              ? "group inline-flex shrink-0 items-center gap-1.5 text-sm font-semibold text-white/80 hover:text-white"
              : "group inline-flex shrink-0 items-center gap-1.5 text-sm font-semibold text-primary"
          }
        >
          {viewAll}
          <ArrowRight
            className="size-4 transition-transform group-hover:translate-x-0.5"
            aria-hidden
          />
        </Link>
      )}
    </div>
  );
}

/** Renders the configured home page sections in order. */
export async function HomeBlocks({
  blocks,
  locale,
  highlights,
}: {
  blocks: HomeBlock[];
  locale: string;
  highlights: StoreHighlight[];
}) {
  const t = await getTranslations("Home");
  // A dark last section runs straight into the (dark) footer, without a white gap.
  const endsDark = blocks.at(-1)?.type === "TESTIMONIALS";

  return (
    <div className={`grid grid-cols-1 gap-14 sm:gap-20 ${endsDark ? "" : "pb-16"}`}>
      {blocks.map((block) => {
        const title = localize(block.title, locale);
        switch (block.type) {
          case "OFFER_STRIP": {
            const message = localize(block.message, locale);
            return (
              <div
                key={block.id}
                className="relative -mb-10 bg-[var(--store-ink)] px-4 py-2.5 text-center text-sm font-medium text-white after:absolute after:inset-x-0 after:bottom-0 after:h-0.5 after:brand-gradient sm:-mb-16"
              >
                <Sparkles
                  className="mr-2 inline size-4 align-[-3px] text-[var(--brand-secondary)]"
                  aria-hidden
                />
                {block.linkUrl ? (
                  <Link href={block.linkUrl} className="underline-offset-4 hover:underline">
                    {message}
                  </Link>
                ) : (
                  message
                )}
              </div>
            );
          }
          case "HERO_BANNER":
            return (
              <div key={block.id} className="grid gap-6 sm:gap-8">
                <HeroSlider banners={block.banners} />
                <StoreHighlights items={highlights} locale={locale} />
              </div>
            );
          case "FEATURED_CATEGORIES":
            return (
              <section key={block.id} className="container mx-auto px-4">
                <SectionHeading title={title} viewAll={t("viewAll")} />
                <ul className="grid grid-cols-2 gap-4 sm:gap-6 lg:grid-cols-3">
                  {block.categories.map((c, i) => {
                    const name = localize(c.name, locale);
                    return (
                      <li key={c.id} className={i === 0 ? "col-span-2 lg:col-span-1" : undefined}>
                        <Link
                          href={`/c/${c.slug}`}
                          className="group relative flex aspect-[16/10] items-end overflow-hidden rounded-3xl bg-[var(--store-ink)] lg:aspect-[4/5]"
                        >
                          {c.imageUrl ? (
                            <Image
                              src={c.imageUrl}
                              alt=""
                              fill
                              sizes={
                                i === 0
                                  ? "(min-width: 1024px) 33vw, 100vw"
                                  : "(min-width: 1024px) 33vw, 50vw"
                              }
                              className="object-cover transition-transform duration-700 group-hover:scale-105"
                              unoptimized={isLocalUpload(c.imageUrl)}
                            />
                          ) : (
                            <span
                              className="absolute inset-0 brand-gradient opacity-90"
                              aria-hidden
                            />
                          )}
                          <span
                            className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/15 to-transparent"
                            aria-hidden
                          />
                          <span className="relative flex w-full items-end justify-between gap-3 p-4 text-white sm:p-6">
                            <span className="font-heading text-lg font-bold sm:text-2xl">
                              {name}
                            </span>
                            <span
                              className={`${i === 0 ? "inline-flex" : "hidden sm:inline-flex"} shrink-0 items-center gap-1.5 rounded-full border border-white/30 bg-white/10 px-3.5 py-1.5 text-xs font-semibold backdrop-blur-md transition-colors group-hover:bg-white group-hover:text-neutral-900`}
                            >
                              {t("shopNow")}
                              <ArrowRight className="size-3.5" aria-hidden />
                            </span>
                          </span>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </section>
            );
          case "PRODUCT_CAROUSEL": {
            // Carousels sit below the hero, highlights and categories: nothing here competes
            // with the hero image for bandwidth.
            return (
              <section key={block.id} className="container mx-auto px-4">
                <SectionHeading title={title} href={block.viewAllHref} viewAll={t("viewAll")} />
                <ScrollRow label={title}>
                  {block.products.map((p) => (
                    <li key={p.id} className="w-[46%] shrink-0 snap-start sm:w-[31%] lg:w-[23%]">
                      <ProductCard product={p} />
                    </li>
                  ))}
                </ScrollRow>
              </section>
            );
          }
          case "TESTIMONIALS":
            return (
              <section key={block.id} className="py-16 ink-surface sm:py-20">
                <div className="container mx-auto px-4">
                  <SectionHeading title={title} viewAll={t("viewAll")} inverted />
                  <ul className="grid gap-5 md:grid-cols-3">
                    {block.items.map((item, i) => (
                      <li
                        key={i}
                        className="grid gap-4 rounded-3xl border border-white/10 bg-white/5 p-6 backdrop-blur-sm"
                      >
                        <div className="flex items-center justify-between">
                          <Quote className="size-7 text-[var(--brand-secondary)]" aria-hidden />
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
                                    : "size-4 text-white/30"
                                }
                                aria-hidden
                              />
                            ))}
                          </span>
                        </div>
                        <p className="text-base leading-relaxed text-white/90">
                          {localize(item.quote, locale)}
                        </p>
                        <p className="mt-auto text-sm font-semibold">
                          {item.author}
                          {item.location && (
                            <span className="font-normal text-white/65"> · {item.location}</span>
                          )}
                        </p>
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
                {title && (
                  <h2 className="mb-4 text-2xl font-bold tracking-tight sm:text-3xl">{title}</h2>
                )}
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
