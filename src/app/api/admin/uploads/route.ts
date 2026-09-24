import { z } from "zod";
import { authorize } from "@/lib/auth-guards";
import type { Permission } from "@/lib/permissions";
import { uploadImage } from "@/lib/services/upload.service";

const FOLDER_PERMISSION = {
  branding: "settings:manage",
  products: "catalog:write",
  categories: "catalog:write",
  banners: "content:manage",
} as const satisfies Record<string, Permission>;

const folderSchema = z.enum(["branding", "products", "categories", "banners"]);

export async function POST(request: Request) {
  const form = await request.formData().catch(() => null);
  const folder = folderSchema.safeParse(form?.get("folder"));
  const file = form?.get("file");
  if (!folder.success || !(file instanceof File)) {
    return Response.json({ ok: false, error: "validation" }, { status: 400 });
  }

  const user = await authorize(FOLDER_PERMISSION[folder.data]);
  if (!user) return Response.json({ ok: false, error: "unauthorized" }, { status: 403 });

  const result = await uploadImage(file, folder.data);
  if (!result.ok) return Response.json(result, { status: 422 });
  return Response.json(result);
}
