import { NextResponse } from "next/server";
import createMiddleware from "next-intl/middleware";
import { routing } from "./i18n/routing";
import { auth } from "./lib/auth";
import { isStaffRole } from "./lib/permissions";

const handleI18n = createMiddleware(routing);
const LOCALE_PATH = new RegExp(`^/(${routing.locales.join("|")})(/.*)?$`);

/**
 * Optimistic route protection (redirects only). Real authorization happens on the server
 * in every admin/account page and action via lib/auth-guards.ts.
 */
export default auth((req) => {
  const { pathname, search } = req.nextUrl;
  const match = LOCALE_PATH.exec(pathname);
  if (match) {
    const locale = match[1];
    const rest = match[2] ?? "/";
    const role = req.auth?.user?.role;
    const toLogin = (loginPath: string) => {
      const url = new URL(`/${locale}${loginPath}`, req.nextUrl);
      url.searchParams.set("callbackUrl", pathname + search);
      return NextResponse.redirect(url);
    };

    const isAdminLogin = rest === "/admin/login";
    if (rest === "/admin" || rest.startsWith("/admin/")) {
      if (isAdminLogin) {
        if (isStaffRole(role))
          return NextResponse.redirect(new URL(`/${locale}/admin`, req.nextUrl));
      } else if (!isStaffRole(role)) {
        return toLogin("/admin/login");
      }
    }

    if ((rest === "/account" || rest.startsWith("/account/")) && !role) {
      return toLogin("/login");
    }
    if (rest === "/login" && role) {
      return NextResponse.redirect(new URL(`/${locale}/account`, req.nextUrl));
    }
  }
  return handleI18n(req);
});

export const config = {
  // Skip API routes, Next internals, Vercel internals and files with an extension.
  matcher: "/((?!api|_next|_vercel|.*\\..*).*)",
};
