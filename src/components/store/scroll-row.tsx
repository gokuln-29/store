"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRef, type ReactNode } from "react";
import { Button } from "@/components/ui/button";

/** Horizontal scroll-snap row with previous/next buttons (no JS needed to scroll by touch). */
export function ScrollRow({ children, label }: { children: ReactNode; label: string }) {
  const t = useTranslations("Home");
  const ref = useRef<HTMLUListElement>(null);
  const scroll = (dir: 1 | -1) =>
    ref.current?.scrollBy({ left: dir * ref.current.clientWidth * 0.8, behavior: "smooth" });

  return (
    // overflow-x-clip: the row scrolls itself; nothing inside may widen the page.
    <div className="relative overflow-x-clip">
      <ul
        ref={ref}
        aria-label={label}
        className="flex snap-x snap-mandatory [scrollbar-width:none] gap-4 overflow-x-auto scroll-smooth pb-2 [&::-webkit-scrollbar]:hidden"
      >
        {children}
      </ul>
      <div className="pointer-events-none absolute inset-y-0 right-1 left-1 hidden items-center justify-between md:flex">
        <Button
          type="button"
          variant="secondary"
          size="icon"
          className="pointer-events-auto -mt-12 rounded-full shadow"
          onClick={() => scroll(-1)}
          aria-label={t("previous")}
        >
          <ChevronLeft className="size-5" aria-hidden />
        </Button>
        <Button
          type="button"
          variant="secondary"
          size="icon"
          className="pointer-events-auto -mt-12 rounded-full shadow"
          onClick={() => scroll(1)}
          aria-label={t("nextSlide")}
        >
          <ChevronRight className="size-5" aria-hidden />
        </Button>
      </div>
    </div>
  );
}
