import { revalidatePath } from "next/cache";
import { sameOriginGuard } from "@/lib/csrf";
import { authorize } from "@/lib/auth-guards";
import { importProductsCsv } from "@/lib/services/product-import.service";

const MAX_BYTES = 5 * 1024 * 1024;

/** POST multipart: file (CSV), dryRun ("1" = only validate). Returns an ImportReport. */
export async function POST(request: Request) {
  const forbidden = sameOriginGuard(request);
  if (forbidden) return forbidden;
  const user = await authorize("catalog:write");
  if (!user) return Response.json({ ok: false, error: "forbidden" }, { status: 403 });

  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File))
    return Response.json({ ok: false, error: "validation" }, { status: 400 });
  if (file.size > MAX_BYTES)
    return Response.json({ ok: false, error: "csvFileTooLarge" }, { status: 413 });
  if (!/\.csv$/i.test(file.name) && !file.type.includes("csv")) {
    return Response.json({ ok: false, error: "csvFileType" }, { status: 415 });
  }

  const dryRun = form?.get("dryRun") !== "0";
  const report = await importProductsCsv(await file.text(), { dryRun, actorId: user.id });
  if (!dryRun) revalidatePath("/", "layout");
  return Response.json({ ok: true, report });
}
