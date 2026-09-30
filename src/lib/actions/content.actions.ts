"use server";

import { revalidateStorefront } from "@/lib/revalidate-storefront";
import { z } from "zod";
import { authorize } from "@/lib/auth-guards";
import {
  deleteBanner,
  deleteSection,
  moveSection,
  saveBanner,
  saveSection,
  setSectionActive,
} from "@/lib/services/content.service";
import {
  bannerFormSchema,
  sectionFormSchema,
  type BannerFormInput,
  type SectionFormInput,
} from "@/lib/validators/content";
import { invalid, type ActionResult } from "./result";

const FORBIDDEN: ActionResult<never> = { ok: false, error: "forbidden" };
const idSchema = z.string().min(1).max(64);

/** Home page content appears on the storefront home in every language. */
function revalidateHome() {
  revalidateStorefront();
}

export async function saveBannerAction(
  id: string | null,
  input: BannerFormInput,
): Promise<ActionResult<{ id: string }>> {
  const user = await authorize("content:manage");
  if (!user) return FORBIDDEN;
  const parsed = bannerFormSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const result = await saveBanner(idSchema.safeParse(id).success ? id : null, parsed.data, user.id);
  if (!result.ok) return { ok: false, error: result.error };
  revalidateHome();
  return { ok: true, data: { id: result.id } };
}

export async function deleteBannerAction(id: string): Promise<ActionResult> {
  const user = await authorize("content:manage");
  if (!user) return FORBIDDEN;
  if (!idSchema.safeParse(id).success) return { ok: false, error: "not_found" };
  const result = await deleteBanner(id, user.id);
  if (!result.ok) return { ok: false, error: "not_found" };
  revalidateHome();
  return { ok: true, data: undefined };
}

export async function saveSectionAction(
  id: string | null,
  input: SectionFormInput,
): Promise<ActionResult<{ id: string }>> {
  const user = await authorize("content:manage");
  if (!user) return FORBIDDEN;
  const parsed = sectionFormSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error, { nested: true });
  const result = await saveSection(
    idSchema.safeParse(id).success ? id : null,
    parsed.data,
    user.id,
  );
  if (!result.ok) return { ok: false, error: result.error };
  revalidateHome();
  return { ok: true, data: { id: result.id } };
}

export async function moveSectionAction(
  id: string,
  direction: "up" | "down",
): Promise<ActionResult> {
  const user = await authorize("content:manage");
  if (!user) return FORBIDDEN;
  if (!idSchema.safeParse(id).success || !["up", "down"].includes(direction))
    return { ok: false, error: "validation" };
  await moveSection(id, direction, user.id);
  revalidateHome();
  return { ok: true, data: undefined };
}

export async function setSectionActiveAction(id: string, isActive: boolean): Promise<ActionResult> {
  const user = await authorize("content:manage");
  if (!user) return FORBIDDEN;
  if (!idSchema.safeParse(id).success || typeof isActive !== "boolean")
    return { ok: false, error: "validation" };
  await setSectionActive(id, isActive, user.id);
  revalidateHome();
  return { ok: true, data: undefined };
}

export async function deleteSectionAction(id: string): Promise<ActionResult> {
  const user = await authorize("content:manage");
  if (!user) return FORBIDDEN;
  if (!idSchema.safeParse(id).success) return { ok: false, error: "not_found" };
  await deleteSection(id, user.id);
  revalidateHome();
  return { ok: true, data: undefined };
}
