import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import {
  listSections,
  moveSection,
  saveBanner,
  saveSection,
  setSectionActive,
} from "@/lib/services/content.service";
import { getHomeBlocks } from "@/lib/services/home.service";
import { bannerFormSchema, sectionFormSchema } from "@/lib/validators/content";

let actorId: string;
const DAY = 86_400_000;
const isoDate = (d: Date) => d.toISOString().slice(0, 10);

beforeEach(async () => {
  actorId = (await db.user.create({ data: { email: "owner@test.dev", role: "OWNER" } })).id;
});

async function banner(
  title: string,
  opts: { startsAt?: string; endsAt?: string; isActive?: boolean } = {},
) {
  const result = await saveBanner(
    null,
    bannerFormSchema.parse({
      title: { en: title },
      subtitle: {},
      ctaLabel: {},
      imageUrl: "/uploads/banners/a.jpg",
      mobileImageUrl: "",
      linkUrl: "/shop",
      sortOrder: "0",
      isActive: opts.isActive ?? true,
      startsAt: opts.startsAt ?? "",
      endsAt: opts.endsAt ?? "",
    }),
    actorId,
  );
  if (!result.ok) throw new Error(result.error);
  return result.id;
}

async function section(input: unknown) {
  const result = await saveSection(null, sectionFormSchema.parse(input), actorId);
  if (!result.ok) throw new Error(result.error);
  return result.id;
}

describe("home page content", () => {
  it("renders active sections in order with live banners only", async () => {
    const live = await banner("Live");
    const expired = await banner("Expired", { endsAt: isoDate(new Date(Date.now() - 2 * DAY)) });
    const future = await banner("Future", { startsAt: isoDate(new Date(Date.now() + 5 * DAY)) });
    await section({
      type: "OFFER_STRIP",
      title: {},
      isActive: true,
      config: { message: { en: "Sale!" }, linkUrl: "/shop" },
    });
    await section({
      type: "HERO_BANNER",
      title: {},
      isActive: true,
      config: { bannerIds: [live, expired, future] },
    });
    const hidden = await section({
      type: "RICH_TEXT",
      title: {},
      isActive: true,
      config: { html: { en: "<p>Hi<script>x()</script></p>" } },
    });
    await setSectionActive(hidden, false, actorId);

    const blocks = await getHomeBlocks("en");
    expect(blocks.map((b) => b.type)).toEqual(["OFFER_STRIP", "HERO_BANNER"]);
    const hero = blocks[1] as Extract<(typeof blocks)[number], { type: "HERO_BANNER" }>;
    expect(hero.banners.map((b) => b.title)).toEqual([{ en: "Live" }]);
  });

  it("sanitizes rich text and skips sections with broken config", async () => {
    await section({
      type: "RICH_TEXT",
      title: {},
      isActive: true,
      config: { html: { en: '<p onclick="x()">Hello</p><script>bad()</script>' } },
    });
    await db.homeSection.create({
      data: { type: "PRODUCT_CAROUSEL", config: { source: "nonsense" }, sortOrder: 99 },
    });
    const blocks = await getHomeBlocks("en");
    expect(blocks).toHaveLength(1);
    expect(blocks[0]).toMatchObject({ type: "RICH_TEXT", html: { en: "<p>Hello</p>" } });
  });

  it("moves sections up and down", async () => {
    const a = await section({
      type: "OFFER_STRIP",
      title: {},
      isActive: true,
      config: { message: { en: "A" }, linkUrl: "" },
    });
    const b = await section({
      type: "OFFER_STRIP",
      title: {},
      isActive: true,
      config: { message: { en: "B" }, linkUrl: "" },
    });
    const c = await section({
      type: "OFFER_STRIP",
      title: {},
      isActive: true,
      config: { message: { en: "C" }, linkUrl: "" },
    });
    await moveSection(c, "up", actorId);
    expect((await listSections()).map((s) => s.id)).toEqual([a, c, b]);
    await moveSection(a, "up", actorId); // already first: no change
    expect((await listSections()).map((s) => s.id)).toEqual([a, c, b]);
    expect(await db.auditLog.count({ where: { action: "home_section.move" } })).toBe(1);
  });

  it("validates section config per type", () => {
    expect(
      sectionFormSchema.safeParse({
        type: "HERO_BANNER",
        title: {},
        isActive: true,
        config: { bannerIds: [] },
      }).success,
    ).toBe(false);
    expect(
      sectionFormSchema.safeParse({
        type: "PRODUCT_CAROUSEL",
        title: {},
        isActive: true,
        config: { source: "category", categoryId: "", limit: "8" },
      }).success,
    ).toBe(false);
    expect(
      sectionFormSchema.safeParse({
        type: "OFFER_STRIP",
        title: {},
        isActive: true,
        config: { message: { en: "Hi" }, linkUrl: "javascript:alert(1)" },
      }).success,
    ).toBe(false);
  });
});
