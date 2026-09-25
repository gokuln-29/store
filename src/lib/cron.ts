import { timingSafeEqual } from "node:crypto";

/**
 * Guards /api/cron/* endpoints: `Authorization: Bearer $CRON_SECRET` (Vercel Cron sends this
 * header automatically). Returns an error response, or null when the caller may proceed.
 */
export function cronGuard(request: Request): Response | null {
  const secret = process.env.CRON_SECRET;
  if (!secret) return Response.json({ error: "CRON_SECRET is not configured" }, { status: 503 });
  const header = request.headers.get("authorization") ?? "";
  const given = Buffer.from(header.startsWith("Bearer ") ? header.slice(7) : "");
  const expected = Buffer.from(secret);
  const ok = given.length === expected.length && timingSafeEqual(given, expected);
  return ok ? null : Response.json({ error: "unauthorized" }, { status: 401 });
}
