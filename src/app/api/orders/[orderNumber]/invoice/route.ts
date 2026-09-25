import { getCurrentUser } from "@/lib/auth-guards";
import { pdfResponse } from "@/lib/pdf-response";
import { can } from "@/lib/permissions";
import { invoicePdf } from "@/lib/services/invoice.service";

export const dynamic = "force-dynamic";

/** GST invoice PDF: the customer's own order, or any order for staff. */
export async function GET(
  _request: Request,
  ctx: RouteContext<"/api/orders/[orderNumber]/invoice">,
) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "unauthorized" }, { status: 401 });
  const { orderNumber } = await ctx.params;
  const number = decodeURIComponent(orderNumber).slice(0, 40);
  const file = await invoicePdf(number, can(user.role, "orders:read") ? null : user.id);
  if (!file) return Response.json({ error: "not_found" }, { status: 404 });
  return pdfResponse(file);
}
