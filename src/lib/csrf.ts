/**
 * CSRF check for cookie-authenticated POST route handlers. Server actions get this from
 * Next.js; route handlers don't. Browsers always send Origin on POST, so a missing or foreign
 * Origin means the request didn't come from our pages. (Session cookies are also SameSite=Lax;
 * this is the second layer, e.g. against a compromised sibling subdomain.)
 */
export function sameOriginGuard(request: Request): Response | null {
  const origin = request.headers.get("origin");
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  if (origin && host) {
    try {
      if (new URL(origin).host === host) return null;
    } catch {
      // malformed Origin: reject below
    }
  }
  return Response.json({ ok: false, error: "forbidden" }, { status: 403 });
}
