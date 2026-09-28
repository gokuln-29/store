import { revalidatePath } from "next/cache";
import { cronGuard } from "@/lib/cron";

export const dynamic = "force-dynamic";

/**
 * Marks every cached page for re-rendering. Called by tools that change the database outside the
 * app (pnpm setup:store, docker/scheduler/restore.sh) with `Authorization: Bearer $CRON_SECRET`.
 */
export async function POST(request: Request) {
  const denied = cronGuard(request);
  if (denied) return denied;
  revalidatePath("/", "layout");
  return Response.json({ ok: true });
}
