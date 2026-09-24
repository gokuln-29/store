import { hasLocale } from "next-intl";
import { routing } from "@/i18n/routing";
import { listStoreProducts } from "@/lib/services/catalog-query.service";
import { localize } from "@/lib/utils/localized";
import { parseListingParams } from "@/lib/utils/store-filters";

/** GET /api/search/suggest?q=…&locale=ta — top matches for the header search box. */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const q = (url.searchParams.get("q") ?? "").trim().slice(0, 80);
  const requested = url.searchParams.get("locale") ?? "";
  const locale = hasLocale(routing.locales, requested) ? requested : routing.defaultLocale;
  if (q.length < 2) return Response.json({ items: [] });

  const { cards } = await listStoreProducts({
    scope: { q },
    params: parseListingParams({ sort: "relevance" }, [], { allowRelevance: true }),
    locale,
    pageSize: 6,
  });
  return Response.json(
    {
      items: cards.map((c) => ({
        slug: c.slug,
        name: localize(c.name, locale),
        image: c.image?.url ?? null,
        price: c.price,
      })),
    },
    { headers: { "Cache-Control": "public, max-age=30, s-maxage=60" } },
  );
}
