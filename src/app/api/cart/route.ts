import { z } from "zod";
import { sameOriginGuard } from "@/lib/csrf";
import { getCurrentUser } from "@/lib/auth-guards";
import { can } from "@/lib/permissions";
import { saveCartIfNewer } from "@/lib/services/cart.service";
import { cartItemsSchema } from "@/lib/validators/checkout";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  items: cartItemsSchema,
  /** When the change was made in the browser (ms since epoch). */
  clientUpdatedAt: z.int().positive(),
});

/**
 * Saves a logged-in customer's cart. A plain JSON endpoint (not a server action) so the
 * service worker can queue it while offline and replay it later (background sync).
 */
export async function POST(request: Request) {
  const forbidden = sameOriginGuard(request);
  if (forbidden) return forbidden;
  const user = await getCurrentUser();
  if (!user || !can(user.role, "account:self")) {
    // Guests keep their cart in the browser only; nothing to retry.
    return Response.json({ saved: false }, { status: 200 });
  }
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "validation" }, { status: 400 });
  // Never trust a clock far in the future (it would block later saves).
  const at = new Date(Math.min(parsed.data.clientUpdatedAt, Date.now() + 5 * 60_000));
  const saved = await saveCartIfNewer(user.id, parsed.data.items, at);
  return Response.json({ saved });
}
