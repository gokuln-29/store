"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { getImageProps } from "next/image";
import { useLocale, useTranslations } from "next-intl";
import { useRef, useState } from "react";
import { preload } from "react-dom";
import { Button } from "@/components/ui/button";
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
    height: 600,
    sizes: "100vw",
    quality: 70,
    unoptimized,
  }).props;
  const mobileSrc = banner.mobileImageUrl ?? banner.imageUrl;
  const mobile = getImageProps({
    src: mobileSrc,
    alt: "",
    width: 800,
    height: banner.mobileImageUrl ? 800 : 300,
    sizes: "100vw",
    quality: 70,
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
      className="relative overflow-x-clip"
    >
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
            <div className="relative aspect-square w-full sm:aspect-[8/3]">
              <BannerPicture banner={b} eager={i === 0} />
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent sm:bg-gradient-to-r" />
              <div className="absolute inset-x-0 bottom-0 grid gap-2 p-6 text-white sm:inset-y-0 sm:max-w-lg sm:content-center sm:p-12">
                <h2 className="text-2xl font-bold sm:text-4xl">{title}</h2>
                {subtitle && <p className="text-sm sm:text-lg">{subtitle}</p>}
                {cta && b.linkUrl && (
                  <span className="mt-2 w-fit rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">
                    {cta}
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
                <Link href={b.linkUrl} className="block" aria-label={title}>
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
          <Button
            type="button"
            variant="secondary"
            size="icon"
            className="absolute top-1/2 left-3 hidden -translate-y-1/2 rounded-full opacity-90 sm:inline-flex"
            onClick={() => go(index - 1)}
            aria-label={t("previous")}
          >
            <ChevronLeft className="size-5" aria-hidden />
          </Button>
          <Button
            type="button"
            variant="secondary"
            size="icon"
            className="absolute top-1/2 right-3 hidden -translate-y-1/2 rounded-full opacity-90 sm:inline-flex"
            onClick={() => go(index + 1)}
            aria-label={t("nextSlide")}
          >
            <ChevronRight className="size-5" aria-hidden />
          </Button>
          <div className="absolute inset-x-0 bottom-3 flex justify-center gap-2">
            {banners.map((b, i) => (
              <button
                key={b.id}
                type="button"
                onClick={() => go(i)}
                aria-label={t("slide", { index: i + 1, total: banners.length })}
                aria-current={i === index}
                className={cn("size-2.5 rounded-full bg-white/60", i === index && "w-6 bg-white")}
              />
            ))}
          </div>
        </>
      )}
    </section>
  );
}
