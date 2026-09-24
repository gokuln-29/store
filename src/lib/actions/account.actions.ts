"use server";

import { revalidatePath } from "next/cache";
import { authorize } from "@/lib/auth-guards";
import { deleteAddress, saveAddress, setDefaultAddress } from "@/lib/services/address.service";
import { updateProfile } from "@/lib/services/user.service";
import {
  addressSchema,
  profileSchema,
  type AddressInput,
  type ProfileInput,
} from "@/lib/validators/auth";
import { invalid, type ActionResult } from "./result";

const UNAUTHORIZED: ActionResult<never> = { ok: false, error: "unauthorized" };

function revalidateAccount() {
  revalidatePath("/[locale]/account", "layout");
}

export async function updateProfileAction(input: ProfileInput): Promise<ActionResult> {
  const user = await authorize("account:self");
  if (!user) return UNAUTHORIZED;
  const parsed = profileSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);

  const result = await updateProfile(user.id, parsed.data);
  if (!result.ok) {
    return result.error === "email_taken"
      ? { ok: false, error: "validation", fieldErrors: { email: "emailTaken" } }
      : { ok: false, error: result.error };
  }
  revalidateAccount();
  return { ok: true, data: undefined };
}

export async function saveAddressAction(
  id: string | null,
  input: AddressInput,
): Promise<ActionResult<{ id: string }>> {
  const user = await authorize("account:self");
  if (!user) return UNAUTHORIZED;
  const parsed = addressSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);

  const result = await saveAddress(user.id, id, parsed.data);
  if (!result.ok) return { ok: false, error: result.error };
  revalidateAccount();
  return { ok: true, data: { id: result.id } };
}

export async function setDefaultAddressAction(id: string): Promise<ActionResult> {
  const user = await authorize("account:self");
  if (!user) return UNAUTHORIZED;
  if (typeof id !== "string" || !id) return { ok: false, error: "not_found" };

  const result = await setDefaultAddress(user.id, id);
  if (!result.ok) return { ok: false, error: result.error };
  revalidateAccount();
  return { ok: true, data: undefined };
}

export async function deleteAddressAction(id: string): Promise<ActionResult> {
  const user = await authorize("account:self");
  if (!user) return UNAUTHORIZED;
  if (typeof id !== "string" || !id) return { ok: false, error: "not_found" };

  const result = await deleteAddress(user.id, id);
  if (!result.ok) return { ok: false, error: result.error };
  revalidateAccount();
  return { ok: true, data: undefined };
}
