"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { authorize, getCurrentUser } from "@/lib/auth-guards";
import { signOut } from "@/lib/auth";
import { isStaffRole } from "@/lib/permissions";
import {
  changeOwnPassword,
  createStaff,
  resetStaffPassword,
  setStaffActive,
  setStaffRole,
} from "@/lib/services/staff.service";
import {
  changePasswordSchema,
  createStaffSchema,
  resetPasswordSchema,
  staffRoleSchema,
  type ChangePasswordInput,
  type CreateStaffInput,
} from "@/lib/validators/staff";
import { invalid, type ActionResult } from "./result";

const FORBIDDEN: ActionResult<never> = { ok: false, error: "forbidden" };
const idSchema = z.string().min(1).max(64);

function revalidateStaff() {
  revalidatePath("/[locale]/admin/(panel)/staff", "page");
}

export async function createStaffAction(
  input: CreateStaffInput,
): Promise<ActionResult<{ id: string }>> {
  const user = await authorize("staff:manage");
  if (!user) return FORBIDDEN;
  const parsed = createStaffSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const result = await createStaff(parsed.data, user.id);
  if (!result.ok) {
    return result.error === "email_taken"
      ? { ok: false, error: "validation", fieldErrors: { email: "email_taken" } }
      : { ok: false, error: result.error };
  }
  revalidateStaff();
  return { ok: true, data: result.data };
}

export async function setStaffActiveAction(id: string, isActive: boolean): Promise<ActionResult> {
  const user = await authorize("staff:manage");
  if (!user) return FORBIDDEN;
  const parsedId = idSchema.safeParse(id);
  if (!parsedId.success || typeof isActive !== "boolean") return { ok: false, error: "validation" };
  const result = await setStaffActive(parsedId.data, isActive, user.id);
  if (!result.ok) return { ok: false, error: result.error };
  revalidateStaff();
  return { ok: true, data: undefined };
}

export async function setStaffRoleAction(id: string, role: string): Promise<ActionResult> {
  const user = await authorize("staff:manage");
  if (!user) return FORBIDDEN;
  const parsedId = idSchema.safeParse(id);
  const parsedRole = staffRoleSchema.safeParse(role);
  if (!parsedId.success || !parsedRole.success) return { ok: false, error: "validation" };
  const result = await setStaffRole(parsedId.data, parsedRole.data, user.id);
  if (!result.ok) return { ok: false, error: result.error };
  revalidateStaff();
  return { ok: true, data: undefined };
}

export async function resetStaffPasswordAction(
  id: string,
  input: { password: string },
): Promise<ActionResult> {
  const user = await authorize("staff:manage");
  if (!user) return FORBIDDEN;
  const parsedId = idSchema.safeParse(id);
  const parsed = resetPasswordSchema.safeParse(input);
  if (!parsedId.success) return { ok: false, error: "validation" };
  if (!parsed.success) return invalid(parsed.error);
  const result = await resetStaffPassword(parsedId.data, parsed.data.password, user.id);
  if (!result.ok) return { ok: false, error: result.error };
  return { ok: true, data: undefined };
}

/** Changes the signed-in staff member's password, then signs them out everywhere. */
export async function changeOwnPasswordAction(
  input: ChangePasswordInput,
  locale: string,
): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user || !isStaffRole(user.role)) return FORBIDDEN;
  const parsed = changePasswordSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const result = await changeOwnPassword(
    user.id,
    parsed.data.currentPassword,
    parsed.data.newPassword,
  );
  if (!result.ok) {
    return result.error === "wrong_password"
      ? { ok: false, error: "validation", fieldErrors: { currentPassword: "wrong_password" } }
      : { ok: false, error: result.error };
  }
  const safeLocale = ["en", "ta", "kn"].includes(locale) ? locale : "en";
  await signOut({ redirectTo: `/${safeLocale}/admin/login?passwordChanged=1` });
  return { ok: true, data: undefined };
}
