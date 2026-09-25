import { authorize } from "@/lib/auth-guards";
import { pdfResponse } from "@/lib/pdf-response";
import { packingSlipPdf } from "@/lib/services/invoice.service";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  ctx: RouteContext<"/api/admin/orders/[orderNumber]/packing-slip">,
) {
  const user = await authorize("orders:read");
  if (!user) return Response.json({ error: "forbidden" }, { status: 403 });
  const { orderNumber } = await ctx.params;
  const file = await packingSlipPdf(decodeURIComponent(orderNumber).slice(0, 40));
  if (!file) return Response.json({ error: "not_found" }, { status: 404 });
  return pdfResponse(file);
}
