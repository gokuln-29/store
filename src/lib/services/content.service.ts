import { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { sanitizeRichText } from "@/lib/utils/sanitize";
import type { BannerFormData, SectionFormData } from "@/lib/validators/content";
import { audit } from "./audit.service";

type Tx = Prisma.TransactionClient;
const json = (v: unknown) => (v == null ? Prisma.DbNull : (v as Prisma.InputJsonValue));

// ───────────── Banners ─────────────

export function listBanners() {
  return db.banner.findMany({ orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] });
}

export function getBanner(id: string) {
  return db.banner.findUnique({ where: { id } });
}

export async function saveBanner(id: string | null, data: BannerFormData, actorId: string) {
  return db.$transaction(
    async (tx): Promise<{ ok: true; id: string } | { ok: false; error: "not_found" }> => {
      const fields = {
        title: data.title as Prisma.InputJsonValue,
        subtitle: json(data.subtitle),
        ctaLabel: json(data.ctaLabel),
        imageUrl: data.imageUrl,
        mobileImageUrl: data.mobileImageUrl,
        linkUrl: data.linkUrl,
        sortOrder: data.sortOrder,
        isActive: data.isActive,
        startsAt: data.startsAt,
        endsAt: data.endsAt,
      };
      if (id) {
        const existing = await tx.banner.findUnique({ where: { id }, select: { id: true } });
        if (!existing) return { ok: false, error: "not_found" };
        await tx.banner.update({ where: { id }, data: fields });
      }
      const banner = id ? { id } : await tx.banner.create({ data: fields, select: { id: true } });
      await audit(
        {
          actorId,
          action: id ? "banner.update" : "banner.create",
          entityType: "Banner",
          entityId: banner.id,
          changes: { title: data.title },
        },
        tx,
      );
      return { ok: true, id: banner.id };
    },
  );
}

export async function deleteBanner(id: string, actorId: string) {
  return db.$transaction(async (tx): Promise<{ ok: boolean }> => {
    const { count } = await tx.banner.deleteMany({ where: { id } });
    if (count)
      await audit({ actorId, action: "banner.delete", entityType: "Banner", entityId: id }, tx);
    return { ok: count > 0 };
  });
}

// ───────────── Home sections ─────────────

export function listSections() {
  return db.homeSection.findMany({ orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] });
}

export function getSection(id: string) {
  return db.homeSection.findUnique({ where: { id } });
}

function storedConfig(data: SectionFormData): Prisma.InputJsonValue {
  if (data.type === "RICH_TEXT") {
    const html = Object.fromEntries(
      Object.entries(data.config.html ?? {})
        .map(([locale, value]) => [locale, sanitizeRichText(value)] as const)
        .filter(([, value]) => value),
    );
    return { html: Object.keys(html).length ? html : null };
  }
  return data.config as unknown as Prisma.InputJsonValue;
}

export async function saveSection(id: string | null, data: SectionFormData, actorId: string) {
  return db.$transaction(
    async (tx): Promise<{ ok: true; id: string } | { ok: false; error: "not_found" }> => {
      const fields = {
        title: json(data.title),
        isActive: data.isActive,
        config: storedConfig(data),
      };
      let sectionId: string;
      if (id) {
        const existing = await tx.homeSection.findUnique({ where: { id }, select: { type: true } });
        if (!existing) return { ok: false, error: "not_found" };
        // The type of an existing section never changes.
        await tx.homeSection.update({ where: { id }, data: fields });
        sectionId = id;
      } else {
        const last = await tx.homeSection.aggregate({ _max: { sortOrder: true } });
        sectionId = (
          await tx.homeSection.create({
            data: { ...fields, type: data.type, sortOrder: (last._max.sortOrder ?? 0) + 1 },
            select: { id: true },
          })
        ).id;
      }
      await audit(
        {
          actorId,
          action: id ? "home_section.update" : "home_section.create",
          entityType: "HomeSection",
          entityId: sectionId,
          changes: { type: data.type },
        },
        tx,
      );
      return { ok: true, id: sectionId };
    },
  );
}

async function normalizeOrder(tx: Tx) {
  const sections = await tx.homeSection.findMany({
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    select: { id: true },
  });
  await Promise.all(
    sections.map((s, i) => tx.homeSection.update({ where: { id: s.id }, data: { sortOrder: i } })),
  );
  return sections.map((s) => s.id);
}

/** Moves a section one place up or down. */
export async function moveSection(id: string, direction: "up" | "down", actorId: string) {
  return db.$transaction(async (tx) => {
    const order = await normalizeOrder(tx);
    const index = order.indexOf(id);
    const target = direction === "up" ? index - 1 : index + 1;
    if (index < 0 || target < 0 || target >= order.length) return { ok: false };
    await tx.homeSection.update({ where: { id }, data: { sortOrder: target } });
    await tx.homeSection.update({ where: { id: order[target]! }, data: { sortOrder: index } });
    await audit(
      {
        actorId,
        action: "home_section.move",
        entityType: "HomeSection",
        entityId: id,
        changes: { direction },
      },
      tx,
    );
    return { ok: true };
  });
}

export async function setSectionActive(id: string, isActive: boolean, actorId: string) {
  return db.$transaction(async (tx) => {
    const { count } = await tx.homeSection.updateMany({ where: { id }, data: { isActive } });
    if (count)
      await audit(
        {
          actorId,
          action: isActive ? "home_section.show" : "home_section.hide",
          entityType: "HomeSection",
          entityId: id,
        },
        tx,
      );
    return { ok: count > 0 };
  });
}

export async function deleteSection(id: string, actorId: string) {
  return db.$transaction(async (tx) => {
    const { count } = await tx.homeSection.deleteMany({ where: { id } });
    if (count)
      await audit(
        { actorId, action: "home_section.delete", entityType: "HomeSection", entityId: id },
        tx,
      );
    return { ok: count > 0 };
  });
}
