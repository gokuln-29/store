"use client";

import { ChevronLeft, ChevronRight, Expand, X } from "lucide-react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState, type MouseEvent } from "react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { isLocalUpload } from "@/lib/utils/images";
import { cn } from "@/lib/utils";

export type GalleryImage = { url: string; alt: string };

/**
 * Product images: swipe on mobile, thumbnails, hover zoom on desktop, and a full-screen
 * viewer. Works with the keyboard (arrows in the viewer, Escape to close).
 */
export function ProductGallery({ images, name }: { images: GalleryImage[]; name: string }) {
  const t = useTranslations("Product");
  const [index, setIndex] = useState(0);
  const [open, setOpen] = useState(false);
  const [zoom, setZoom] = useState<{ x: number; y: number } | null>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const count = images.length;

  const show = (i: number, smooth = true) => {
    const next = (i + count) % count;
    setIndex(next);
    const el = trackRef.current;
    if (el) el.scrollTo({ left: next * el.clientWidth, behavior: smooth ? "smooth" : "auto" });
  };

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") setIndex((i) => (i + 1) % count);
      if (e.key === "ArrowLeft") setIndex((i) => (i - 1 + count) % count);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, count]);

  if (count === 0) return <div className="aspect-square rounded-lg bg-muted" />;

  const onMove = (e: MouseEvent<HTMLElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setZoom({
      x: ((e.clientX - rect.left) / rect.width) * 100,
      y: ((e.clientY - rect.top) / rect.height) * 100,
    });
  };

  return (
    <section aria-label={t("gallery")} className="grid gap-3">
      <div className="relative">
        <div
          ref={trackRef}
          onScroll={(e) =>
            setIndex(Math.round(e.currentTarget.scrollLeft / e.currentTarget.clientWidth))
          }
          className="flex snap-x snap-mandatory [scrollbar-width:none] overflow-x-auto rounded-lg [&::-webkit-scrollbar]:hidden"
        >
          {images.map((img, i) => (
            <button
              key={img.url}
              type="button"
              onClick={() => setOpen(true)}
              onMouseMove={onMove}
              onMouseLeave={() => setZoom(null)}
              className="relative aspect-square w-full shrink-0 snap-start overflow-hidden bg-muted md:cursor-zoom-in"
              aria-label={t("openFullscreen")}
            >
              <Image
                src={img.url}
                alt={img.alt || name}
                fill
                sizes="(min-width: 1024px) 50vw, 100vw"
                // Only the first image competes for bandwidth on load; the rest load when needed.
                priority={i === 0}
                fetchPriority={i === 0 ? "high" : "low"}
                className="object-cover transition-transform duration-150 md:[transform:var(--zoom)]"
                style={
                  zoom && i === index
                    ? ({
                        "--zoom": "scale(2)",
                        transformOrigin: `${zoom.x}% ${zoom.y}%`,
                      } as React.CSSProperties)
                    : undefined
                }
                unoptimized={isLocalUpload(img.url)}
              />
            </button>
          ))}
        </div>
        <span className="pointer-events-none absolute right-3 bottom-3 inline-flex items-center gap-1 rounded-full bg-background/90 px-2 py-1 text-xs">
          <Expand className="size-3.5" aria-hidden />
          {index + 1}/{count}
        </span>
      </div>

      {count > 1 && (
        <ul className="flex gap-2 overflow-x-auto">
          {images.map((img, i) => (
            <li key={img.url}>
              <button
                type="button"
                onClick={() => show(i)}
                aria-label={t("showImage", { index: i + 1 })}
                aria-current={i === index}
                className={cn(
                  "relative block size-16 overflow-hidden rounded-md border-2 bg-muted",
                  i === index ? "border-primary" : "border-transparent",
                )}
              >
                <Image
                  src={img.url}
                  alt=""
                  fill
                  sizes="64px"
                  fetchPriority="low"
                  className="object-cover"
                  unoptimized={isLocalUpload(img.url)}
                />
              </button>
            </li>
          ))}
        </ul>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          showCloseButton={false}
          className="h-dvh max-w-none rounded-none border-0 bg-black p-0 sm:max-w-none"
        >
          <DialogTitle className="sr-only">{name}</DialogTitle>
          <div className="relative h-full w-full">
            <Image
              src={images[index]!.url}
              alt={images[index]!.alt || name}
              fill
              sizes="100vw"
              className="object-contain"
              unoptimized={isLocalUpload(images[index]!.url)}
            />
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="absolute top-4 right-4 rounded-full bg-white/90 p-2 text-black"
              aria-label={t("close")}
            >
              <X className="size-5" aria-hidden />
            </button>
            {count > 1 && (
              <>
                <button
                  type="button"
                  onClick={() => show(index - 1, false)}
                  className="absolute top-1/2 left-4 -translate-y-1/2 rounded-full bg-white/90 p-2 text-black"
                  aria-label={t("previousImage")}
                >
                  <ChevronLeft className="size-5" aria-hidden />
                </button>
                <button
                  type="button"
                  onClick={() => show(index + 1, false)}
                  className="absolute top-1/2 right-4 -translate-y-1/2 rounded-full bg-white/90 p-2 text-black"
                  aria-label={t("nextImage")}
                >
                  <ChevronRight className="size-5" aria-hidden />
                </button>
                <p className="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full bg-white/90 px-3 py-1 text-sm text-black">
                  {index + 1}/{count}
                </p>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </section>
  );
}
