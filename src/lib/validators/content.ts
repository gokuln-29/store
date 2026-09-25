import { z } from "./zod";
import {
  intFromString,
  optionalLocalizedSchema,
  optionalText,
  requiredLocalizedSchema,
} from "./common";

// Messages are keys in the "Errors" namespace.

/** Internal path ("/c/sarees") or full https link. */
const linkSchema = z
  .string()
  .trim()
  .max(500, "tooLong")
  .refine(
    (v) => v === "" || (v.startsWith("/") && !v.startsWith("//")) || /^https:\/\/\S+$/.test(v),
    "linkInvalid",
  )
  .transform((v) => v || null);

const imageSchema = z
  .string()
  .trim()
  .max(2000, "tooLong")
  .refine((v) => v.startsWith("/") || /^https:\/\//.test(v), "required");

const optionalImage = z
  .string()
  .trim()
  .max(2000, "tooLong")
  .refine((v) => v === "" || v.startsWith("/") || /^https:\/\//.test(v), "urlInvalid")
  .transform((v) => v || null);

const optionalDate = z
  .string()
  .trim()
  .refine((v) => v === "" || /^\d{4}-\d{2}-\d{2}$/.test(v), "dateInvalid")
  .transform((v) => (v ? new Date(`${v}T00:00:00+05:30`) : null));

export const bannerFormSchema = z
  .object({
    title: requiredLocalizedSchema("en"),
    subtitle: optionalLocalizedSchema,
    ctaLabel: optionalLocalizedSchema,
    imageUrl: imageSchema,
    mobileImageUrl: optionalImage,
    linkUrl: linkSchema,
    sortOrder: intFromString({ min: -10_000, max: 10_000 }),
    isActive: z.boolean(),
    startsAt: optionalDate,
    endsAt: optionalDate,
  })
  .superRefine((v, ctx) => {
    if (v.startsAt && v.endsAt && v.endsAt < v.startsAt) {
      ctx.addIssue({ code: "custom", path: ["endsAt"], message: "maxBelowMin" });
    }
  });
export type BannerFormInput = z.input<typeof bannerFormSchema>;
export type BannerFormData = z.output<typeof bannerFormSchema>;

// ───────────── Home sections ─────────────

export const SECTION_TYPES = [
  "HERO_BANNER",
  "FEATURED_CATEGORIES",
  "PRODUCT_CAROUSEL",
  "OFFER_STRIP",
  "TESTIMONIALS",
  "RICH_TEXT",
] as const;
export type SectionType = (typeof SECTION_TYPES)[number];

const ids = z.array(z.string().min(1).max(64)).max(50, "tooMany");

const common = { title: optionalLocalizedSchema, isActive: z.boolean() };

export const sectionFormSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("HERO_BANNER"),
    ...common,
    config: z.object({ bannerIds: ids.min(1, "pickAtLeastOne") }),
  }),
  z.object({
    type: z.literal("FEATURED_CATEGORIES"),
    ...common,
    config: z.object({ categoryIds: ids.min(1, "pickAtLeastOne") }),
  }),
  z.object({
    type: z.literal("PRODUCT_CAROUSEL"),
    ...common,
    config: z
      .object({
        source: z.enum(["featured", "newest", "category"]),
        categoryId: z.string().trim().max(64),
        limit: intFromString({ min: 2, max: 24 }),
      })
      .superRefine((c, ctx) => {
        if (c.source === "category" && !c.categoryId) {
          ctx.addIssue({ code: "custom", path: ["categoryId"], message: "required" });
        }
      })
      .transform((c) => ({ ...c, categoryId: c.source === "category" ? c.categoryId : null })),
  }),
  z.object({
    type: z.literal("OFFER_STRIP"),
    ...common,
    config: z.object({ message: requiredLocalizedSchema("en"), linkUrl: linkSchema }),
  }),
  z.object({
    type: z.literal("TESTIMONIALS"),
    ...common,
    config: z.object({
      items: z
        .array(
          z.object({
            quote: requiredLocalizedSchema("en"),
            author: z.string().trim().min(1, "required").max(80, "tooLong"),
            location: optionalText(80),
            rating: intFromString({ min: 1, max: 5 }),
          }),
        )
        .min(1, "pickAtLeastOne")
        .max(12, "tooMany"),
    }),
  }),
  z.object({
    type: z.literal("RICH_TEXT"),
    ...common,
    config: z.object({ html: optionalLocalizedSchema }),
  }),
]);
export type SectionFormInput = z.input<typeof sectionFormSchema>;
export type SectionFormData = z.output<typeof sectionFormSchema>;

/** Shapes of the stored `HomeSection.config` JSON (validated again when rendering). */
const localized = z.record(z.string(), z.string());
export const storedSectionConfig = {
  HERO_BANNER: z.object({ bannerIds: z.array(z.string()) }),
  FEATURED_CATEGORIES: z.object({ categoryIds: z.array(z.string()) }),
  PRODUCT_CAROUSEL: z.object({
    source: z.enum(["featured", "newest", "category"]),
    categoryId: z.string().nullable(),
    limit: z.number().int(),
  }),
  OFFER_STRIP: z.object({ message: localized, linkUrl: z.string().nullable() }),
  TESTIMONIALS: z.object({
    items: z.array(
      z.object({
        quote: localized,
        author: z.string(),
        location: z.string().nullable(),
        rating: z.number().int(),
      }),
    ),
  }),
  RICH_TEXT: z.object({ html: localized.nullable() }),
} satisfies Record<SectionType, z.ZodType>;
