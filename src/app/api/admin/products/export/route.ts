import { z } from "zod";
import { authorize } from "@/lib/auth-guards";
import { exportProductsCsv } from "@/lib/services/product-import.service";

const querySchema = z.object({
  status: z.enum(["DRAFT", "PUBLISHED", "ARCHIVED"]).optional(),
  template: z.literal("1").optional(),
});

export async function GET(request: Request) {
  const user = await authorize("catalog:read");
  if (!user) return new Response("Forbidden", { status: 403 });

  const params = Object.fromEntries(new URL(request.url).searchParams);
  const query = querySchema.safeParse(params);
  if (!query.success) return new Response("Bad request", { status: 400 });

  const csv = await exportProductsCsv({
    status: query.data.status,
    templateOnly: query.data.template === "1",
  });
  const date = new Date().toISOString().slice(0, 10);
  const name = query.data.template ? "products-template.csv" : `products-${date}.csv`;
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${name}"`,
      "Cache-Control": "no-store",
    },
  });
}
