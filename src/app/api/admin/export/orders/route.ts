import { z } from "zod";
import { authorize } from "@/lib/auth-guards";
import { exportOrdersCsv } from "@/lib/services/customer.service";
import { RANGES, rangeBounds } from "@/lib/services/dashboard.service";
import { istDayStart } from "@/lib/services/order.service";

export const dynamic = "force-dynamic";

const querySchema = z.object({
  range: z.enum(RANGES).optional(),
  from: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  to: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
});

/** Orders as CSV: a dashboard range (?range=7d) or IST dates (?from=YYYY-MM-DD&to=YYYY-MM-DD). */
export async function GET(request: Request) {
  const user = await authorize("reports:read");
  if (!user) return new Response("Forbidden", { status: 403 });
  const query = querySchema.safeParse(Object.fromEntries(new URL(request.url).searchParams));
  if (!query.success) return new Response("Bad request", { status: 400 });

  let from: Date;
  let to = new Date();
  if (query.data.from) {
    from = istDayStart(query.data.from)!;
    if (query.data.to) to = new Date(istDayStart(query.data.to)!.getTime() + 24 * 60 * 60_000);
  } else {
    from = rangeBounds(query.data.range ?? "30d").start;
  }
  const csv = await exportOrdersCsv(from, to, user.id);
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="orders-${new Date().toISOString().slice(0, 10)}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
