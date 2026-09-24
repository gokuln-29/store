import type { Session } from "next-auth";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { can, type Permission } from "@/lib/permissions";

export type SessionUser = Session["user"];

export async function getCurrentUser(): Promise<SessionUser | null> {
  const session = await auth();
  return session?.user?.id ? session.user : null;
}

/** For customer pages: sends signed-out visitors to the OTP login. */
export async function requireUser(locale: string, callbackPath?: string): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) {
    const query = callbackPath ? `?callbackUrl=${encodeURIComponent(callbackPath)}` : "";
    redirect(`/${locale}/login${query}`);
  }
  return user;
}

/**
 * For admin pages: signed-out visitors go to the admin login; signed-in users
 * without the permission get a 404 so admin URLs are not revealed.
 */
export async function requirePermission(
  permission: Permission,
  locale: string,
  callbackPath?: string,
): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) {
    const query = callbackPath ? `?callbackUrl=${encodeURIComponent(callbackPath)}` : "";
    redirect(`/${locale}/admin/login${query}`);
  }
  if (!can(user.role, permission)) notFound();
  return user;
}

/** For server actions and route handlers: returns the user or null, never redirects. */
export async function authorize(permission: Permission): Promise<SessionUser | null> {
  const user = await getCurrentUser();
  return user && can(user.role, permission) ? user : null;
}
