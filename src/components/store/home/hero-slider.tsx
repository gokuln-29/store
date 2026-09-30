"use client";

import { ArrowRight, ChevronLeft, ChevronRight } from "lucide-react";
import { getImageProps } from "next/image";
import { useLocale, useTranslations } from "next-intl";
import { useRef, useState } from "react";
import { preload } from "react-dom";
import { Link } from "@/i18n/navigation";
import type { HomeBlock } from "@/lib/services/home.service";
import { isLocalUpload } from "@/lib/utils/images";
import { localize } from "@/lib/utils/localized";
import { cn } from "@/lib/utils";

type Banners = Extract<HomeBlock, { type: "HERO_BANNER" }>["banners"];

type Banner = Banners[number];

/**
 * Art-directed banner: a square image on phones and a wide one on larger screens, both
 * optimized by next/image. The first banner is preloaded for each screen size (it is usually
 * the largest thing on the page).
 */
function BannerPicture({ banner, eager }: { banner: Banner; eager: boolean }) {
  const unoptimized = isLocalUpload(banner.imageUrl);
  const desktop = getImageProps({
    src: banner.imageUrl,
    alt: "",
    width: 1600,
    height: 686,
    sizes: "100vw",
    quality: 60,
    unoptimized,
  }).props;
  const mobileSrc = banner.mobileImageUrl ?? banner.imageUrl;
  const mobile = getImageProps({
    src: mobileSrc,
    alt: "",
    width: 800,
    height: 1000,
    sizes: "100vw",
    quality: 60,
    unoptimized: isLocalUpload(mobileSrc),
  }).props;

  if (eager) {
    for (const [props, media] of [
      [mobile, "(max-width: 639px)"],
      [desktop, "(min-width: 640px)"],
    ] as const) {
      preload(props.src, {
        as: "image",
        fetchPriority: "high",
        imageSrcSet: props.srcSet,
        imageSizes: props.sizes,
        media,
      });
    }
  }

  const { srcSet: _desktopSet, ...imgProps } = desktop;
  return (
    <picture>
      <source
        media="(max-width: 639px)"
        srcSet={mobile.srcSet ?? mobile.src}
        sizes={mobile.sizes}
      />
      <source
        media="(min-width: 640px)"
        srcSet={desktop.srcSet ?? desktop.src}
        sizes={desktop.sizes}
      />
      {/* eslint-disable-next-line jsx-a11y/alt-text -- decorative: alt="" comes from imgProps */}
      <img
        {...imgProps}
        loading={eager ? "eager" : "lazy"}
        fetchPriority={eager ? "high" : "low"}
        className="absolute inset-0 h-full w-full object-cover"
      />
    </picture>
  );
}

/** Swipeable banner slider (scroll-snap). No autoplay, so nothing moves unexpectedly. */
export function HeroSlider({ banners }: { banners: Banners }) {
  const locale = useLocale();
  const t = useTranslations("Home");
  const ref = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(0);

  const go = (i: number) => {
    const el = ref.current;
    if (!el) return;
    const next = (i + banners.length) % banners.length;
    el.scrollTo({ left: next * el.clientWidth, behavior: "smooth" });
  };

  return (
    <section
      aria-roledescription="carousel"
      aria-label={localize(banners[0]?.title, locale)}
      className="container mx-auto px-4 pt-4 sm:pt-6"
    >
      <div className="relative overflow-hidden rounded-3xl bg-[var(--store-ink)] shadow-2xl shadow-black/10">
        <div
          ref={ref}
          onScroll={(e) =>
            setIndex(Math.round(e.currentTarget.scrollLeft / e.currentTarget.clientWidth))
          }
          className="flex snap-x snap-mandatory [scrollbar-width:none] overflow-x-auto [&::-webkit-scrollbar]:hidden"
        >
          {banners.map((b, i) => {
            const title = localize(b.title, locale);
            const subtitle = localize(b.subtitle, locale);
            const cta = localize(b.ctaLabel, locale);
            const content = (
              <div className="relative aspect-[4/5] w-full sm:aspect-[21/9]">
                <BannerPicture banner={b} eager={i === 0} />
                <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/35 to-transparent sm:bg-gradient-to-r sm:from-black/80 sm:via-black/40 sm:to-transparent" />
                <div className="absolute inset-x-0 bottom-0 grid gap-3 p-6 pb-12 text-white sm:inset-y-0 sm:max-w-2xl sm:content-center sm:p-14">
                  <h2 className="text-3xl leading-[1.05] font-bold tracking-tight text-balance sm:text-5xl lg:text-6xl">
                    {title}
                  </h2>
                  {subtitle && (
                    <p className="max-w-md text-base text-white/80 sm:text-lg">{subtitle}</p>
                  )}
                  {cta && b.linkUrl && (
                    <span className="mt-3 inline-flex w-fit items-center gap-2 rounded-full bg-white px-6 py-3 text-sm font-semibold text-neutral-900 transition-transform group-hover:translate-x-0.5">
                      {cta}
                      <ArrowRight className="size-4" aria-hidden />
                    </span>
                  )}
                </div>
              </div>
            );
            return (
              <div
                key={b.id}
                className="w-full shrink-0 snap-start"
                role="group"
                aria-roledescription="slide"
                aria-label={t("slide", { index: i + 1, total: banners.length })}
              >
                {b.linkUrl ? (
                  <Link href={b.linkUrl} className="group block" aria-label={title}>
                    {content}
                  </Link>
                ) : (
                  content
                )}
              </div>
            );
          })}
        </div>
        {banners.length > 1 && (
          <>
            <div className="absolute bottom-5 left-6 flex gap-2 sm:left-14">
              {banners.map((b, i) => (
                <button
                  key={b.id}
                  type="button"
                  onClick={() => go(i)}
                  aria-label={t("slide", { index: i + 1, total: banners.length })}
                  aria-current={i === index}
                  className={cn(
                    "h-1.5 w-6 rounded-full bg-white/40 transition-all",
                    i === index && "w-12 bg-white",
                  )}
                />
              ))}
            </div>
            <div className="absolute right-5 bottom-4 hidden gap-2 sm:flex">
              <button
                type="button"
                className="grid size-11 place-items-center rounded-full border border-white/25 bg-white/10 text-white backdrop-blur-md transition-colors hover:bg-white/25"
                onClick={() => go(index - 1)}
                aria-label={t("previous")}
              >
                <ChevronLeft className="size-5" aria-hidden />
              </button>
              <button
                type="button"
                className="grid size-11 place-items-center rounded-full border border-white/25 bg-white/10 text-white backdrop-blur-md transition-colors hover:bg-white/25"
                onClick={() => go(index + 1)}
                aria-label={t("nextSlide")}
              >
                <ChevronRight className="size-5" aria-hidden />
              </button>
            </div>
          </>
        )}
      </div>
    </section>
  );
}
