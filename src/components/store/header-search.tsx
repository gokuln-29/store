"use client";

import { Loader2, Search, X } from "lucide-react";
import Image from "next/image";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useId, useRef, useState } from "react";
import { Link, useRouter } from "@/i18n/navigation";
import { isLocalUpload } from "@/lib/utils/images";
import { formatINR } from "@/lib/utils/money";
import { cn } from "@/lib/utils";

type Suggestion = { slug: string; name: string; image: string | null; price: number };

/** Search box with debounced suggestions (ARIA combobox). Enter goes to the full results page. */
export function HeaderSearch({
  className,
  autoFocus = false,
  initialQuery = "",
}: {
  className?: string;
  autoFocus?: boolean;
  initialQuery?: string;
}) {
  const t = useTranslations("Search");
  const locale = useLocale();
  const router = useRouter();
  const listId = useId();
  const [q, setQ] = useState(initialQuery);
  const [items, setItems] = useState<Suggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [loading, setLoading] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const query = q.trim();
    // Suggestions are only shown for 2+ characters (see showList), so nothing to fetch.
    if (query.length < 2) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(
          `/api/search/suggest?q=${encodeURIComponent(query)}&locale=${locale}`,
          { signal: controller.signal },
        );
        const data = (await res.json()) as { items: Suggestion[] };
        setItems(data.items);
        setActive(-1);
      } catch {
        // Aborted or offline: keep the previous suggestions.
      } finally {
        setLoading(false);
      }
    }, 250);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [q, locale]);

  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (!boxRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  const showList = open && q.trim().length >= 2 && (items.length > 0 || !loading);
  const go = (href: string) => {
    setOpen(false);
    router.push(href);
  };

  return (
    <div ref={boxRef} className={cn("relative", className)}>
      <form
        role="search"
        onSubmit={(e) => {
          e.preventDefault();
          const query = q.trim();
          if (active >= 0 && items[active]) go(`/p/${items[active].slug}`);
          else if (query) go(`/search?q=${encodeURIComponent(query)}`);
        }}
      >
        <Search
          className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden
        />
        <input
          type="search"
          role="combobox"
          aria-label={t("placeholder")}
          aria-expanded={showList}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={active >= 0 ? `${listId}-${active}` : undefined}
          autoFocus={autoFocus}
          value={q}
          placeholder={t("placeholder")}
          onChange={(e) => {
            setQ(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setOpen(true);
              setActive((a) => Math.min(items.length - 1, a + 1));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setActive((a) => Math.max(-1, a - 1));
            } else if (e.key === "Escape") {
              setOpen(false);
            }
          }}
          className="h-10 w-full rounded-full border bg-muted/40 pr-9 pl-9 text-sm outline-none focus:border-ring focus:bg-background focus:ring-[3px] focus:ring-ring/40 [&::-webkit-search-cancel-button]:hidden"
        />
        {loading ? (
          <Loader2
            className="absolute top-1/2 right-3 size-4 -translate-y-1/2 animate-spin text-muted-foreground"
            aria-hidden
          />
        ) : (
          q && (
            <button
              type="button"
              onClick={() => setQ("")}
              className="absolute top-1/2 right-2 -translate-y-1/2 rounded-full p-1 text-muted-foreground hover:text-foreground"
              aria-label={t("clear")}
            >
              <X className="size-4" aria-hidden />
            </button>
          )
        )}
      </form>
      {showList && (
        <div className="absolute inset-x-0 top-full z-50 mt-2 overflow-hidden rounded-lg border bg-popover shadow-lg">
          <ul id={listId} role="listbox" aria-label={t("suggestions")}>
            {items.length === 0 ? (
              <li
                className="px-4 py-3 text-sm text-muted-foreground"
                role="option"
                aria-selected={false}
                aria-disabled
              >
                {t("noResults", { q: q.trim() })}
              </li>
            ) : (
              items.map((item, i) => (
                <li
                  key={item.slug}
                  id={`${listId}-${i}`}
                  role="option"
                  aria-selected={i === active}
                >
                  <Link
                    href={`/p/${item.slug}`}
                    onClick={() => setOpen(false)}
                    className={cn(
                      "flex items-center gap-3 px-3 py-2 text-sm hover:bg-accent",
                      i === active && "bg-accent",
                    )}
                  >
                    <span className="relative size-10 shrink-0 overflow-hidden rounded bg-muted">
                      {item.image && (
                        <Image
                          src={item.image}
                          alt=""
                          fill
                          sizes="40px"
                          className="object-cover"
                          unoptimized={isLocalUpload(item.image)}
                        />
                      )}
                    </span>
                    <span className="min-w-0 flex-1 truncate">{item.name}</span>
                    <span className="shrink-0 text-muted-foreground tabular-nums">
                      {formatINR(item.price, locale)}
                    </span>
                  </Link>
                </li>
              ))
            )}
          </ul>
          {items.length > 0 && (
            <Link
              href={`/search?q=${encodeURIComponent(q.trim())}`}
              onClick={() => setOpen(false)}
              className="block border-t px-4 py-2.5 text-sm font-medium text-primary hover:bg-accent"
            >
              {t("seeAll", { q: q.trim() })}
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
