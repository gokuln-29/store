import { authorize } from "@/lib/auth-guards";
import { exportCustomersCsv } from "@/lib/services/customer.service";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await authorize("reports:read");
  if (!user) return new Response("Forbidden", { status: 403 });
  const csv = await exportCustomersCsv(user.id);
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="customers-${new Date().toISOString().slice(0, 10)}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
