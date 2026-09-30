"use server";

import { revalidateStorefront } from "@/lib/revalidate-storefront";
import { z } from "zod";
import { authorize } from "@/lib/auth-guards";
import { deleteCategory, saveCategory } from "@/lib/services/category.service";
import { setVariantStock } from "@/lib/services/inventory.service";
import { saveProduct, setProductsStatus } from "@/lib/services/product.service";
import {
  categoryFormSchema,
  productFormSchema,
  type CategoryFormInput,
  type ProductFormInput,
} from "@/lib/validators/catalog-forms";
import { invalid, type ActionResult } from "./result";

const FORBIDDEN: ActionResult<never> = { ok: false, error: "forbidden" };
const idSchema = z.string().min(1).max(64);

/** Catalog changes affect admin lists and every storefront page that shows products. */
function revalidateCatalog() {
  revalidateStorefront();
}

export async function saveCategoryAction(
  id: string | null,
  input: CategoryFormInput,
): Promise<ActionResult<{ id: string }>> {
  const user = await authorize("catalog:write");
  if (!user) return FORBIDDEN;
  const parsed = categoryFormSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const result = await saveCategory(
    idSchema.safeParse(id).success ? id : null,
    parsed.data,
    user.id,
  );
  if (!result.ok) {
    return result.fieldErrors
      ? { ok: false, error: "validation", fieldErrors: result.fieldErrors }
      : { ok: false, error: result.error };
  }
  revalidateCatalog();
  return { ok: true, data: { id: result.id } };
}

export async function deleteCategoryAction(id: string): Promise<ActionResult> {
  const user = await authorize("catalog:write");
  if (!user) return FORBIDDEN;
  if (!idSchema.safeParse(id).success) return { ok: false, error: "not_found" };
  const result = await deleteCategory(id, user.id);
  if (!result.ok) return { ok: false, error: result.error };
  revalidateCatalog();
  return { ok: true, data: undefined };
}

export async function saveProductAction(
  id: string | null,
  input: ProductFormInput,
): Promise<ActionResult<{ id: string; slug: string }>> {
  const user = await authorize("catalog:write");
  if (!user) return FORBIDDEN;
  const parsed = productFormSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error, { nested: true });
  const result = await saveProduct(
    idSchema.safeParse(id).success ? id : null,
    parsed.data,
    user.id,
  );
  if (!result.ok) {
    return result.fieldErrors
      ? { ok: false, error: "validation", fieldErrors: result.fieldErrors }
      : { ok: false, error: result.error };
  }
  revalidateCatalog();
  return { ok: true, data: { id: result.id, slug: result.slug } };
}

const bulkStatusSchema = z.object({
  ids: z.array(idSchema).min(1).max(500),
  status: z.enum(["DRAFT", "PUBLISHED", "ARCHIVED"]),
});

export async function setProductsStatusAction(
  ids: string[],
  status: string,
): Promise<ActionResult<{ count: number }>> {
  const user = await authorize("catalog:write");
  if (!user) return FORBIDDEN;
  const parsed = bulkStatusSchema.safeParse({ ids, status });
  if (!parsed.success) return { ok: false, error: "validation" };
  const count = await setProductsStatus(parsed.data.ids, parsed.data.status, user.id);
  revalidateCatalog();
  return { ok: true, data: { count } };
}

const stockSchema = z.object({ id: idSchema, stock: z.int().min(0).max(10_000_000) });

export async function setVariantStockAction(
  id: string,
  stock: number,
): Promise<ActionResult<{ stock: number }>> {
  const user = await authorize("catalog:write");
  if (!user) return FORBIDDEN;
  const parsed = stockSchema.safeParse({ id, stock });
  if (!parsed.success)
    return { ok: false, error: "validation", fieldErrors: { stock: "numberInvalid" } };
  const result = await setVariantStock(parsed.data.id, parsed.data.stock, user.id);
  if (!result.ok) return { ok: false, error: result.error };
  revalidateCatalog();
  return { ok: true, data: { stock: result.stock } };
}
