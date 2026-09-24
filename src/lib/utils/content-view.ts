import type { SectionFormInput, SectionType } from "@/lib/validators/content";
import { toLocalizedInput } from "./catalog-view";

type Stored = { type: string; title: unknown; isActive: boolean; config: unknown };

/** Blank form values for a new section of the given type. */
export function newSectionInput(type: SectionType): SectionFormInput {
  const base = { title: {}, isActive: true };
  switch (type) {
    case "HERO_BANNER":
      return { ...base, type, config: { bannerIds: [] } };
    case "FEATURED_CATEGORIES":
      return { ...base, type, config: { categoryIds: [] } };
    case "PRODUCT_CAROUSEL":
      return { ...base, type, config: { source: "featured", categoryId: "", limit: "8" } };
    case "OFFER_STRIP":
      return { ...base, type, config: { message: {}, linkUrl: "" } };
    case "TESTIMONIALS":
      return {
        ...base,
        type,
        config: { items: [{ quote: {}, author: "", location: "", rating: "5" }] },
      };
    case "RICH_TEXT":
      return { ...base, type, config: { html: {} } };
  }
}

/** Stored section -> form values. Missing/invalid config falls back to blank values. */
export function sectionToFormInput(section: Stored): SectionFormInput {
  const type = section.type as SectionType;
  const blank = newSectionInput(type);
  const c = (section.config ?? {}) as Record<string, unknown>;
  const title = toLocalizedInput(section.title);
  const common = { title, isActive: section.isActive };
  switch (type) {
    case "HERO_BANNER":
      return {
        ...common,
        type,
        config: { bannerIds: Array.isArray(c.bannerIds) ? (c.bannerIds as string[]) : [] },
      };
    case "FEATURED_CATEGORIES":
      return {
        ...common,
        type,
        config: { categoryIds: Array.isArray(c.categoryIds) ? (c.categoryIds as string[]) : [] },
      };
    case "PRODUCT_CAROUSEL":
      return {
        ...common,
        type,
        config: {
          source: (["featured", "newest", "category"].includes(String(c.source))
            ? c.source
            : "featured") as "featured",
          categoryId: typeof c.categoryId === "string" ? c.categoryId : "",
          limit: typeof c.limit === "number" ? String(c.limit) : "8",
        },
      };
    case "OFFER_STRIP":
      return {
        ...common,
        type,
        config: {
          message: toLocalizedInput(c.message),
          linkUrl: typeof c.linkUrl === "string" ? c.linkUrl : "",
        },
      };
    case "TESTIMONIALS":
      return {
        ...common,
        type,
        config: {
          items: Array.isArray(c.items)
            ? (c.items as Record<string, unknown>[]).map((item) => ({
                quote: toLocalizedInput(item.quote),
                author: String(item.author ?? ""),
                location: typeof item.location === "string" ? item.location : "",
                rating: String(item.rating ?? 5),
              }))
            : [],
        },
      };
    case "RICH_TEXT":
      return { ...common, type, config: { html: toLocalizedInput(c.html) } };
    default:
      return blank;
  }
}

/** Date -> "YYYY-MM-DD" in India time, for date inputs. */
export function toDateInput(date: Date | null): string {
  if (!date) return "";
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(date);
}
