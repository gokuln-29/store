"use client";

let pending: Promise<string | null> | null = null;

/**
 * The signed-in user's id, read from the session endpoint once per page load (pages stay
 * static, so the server doesn't render per-user state). Null for guests or when offline.
 */
export function sessionUserId(): Promise<string | null> {
  pending ??= fetch("/api/auth/session", { cache: "no-store" })
    .then((res) => res.json() as Promise<{ user?: { id?: string } } | null>)
    .then((session) => session?.user?.id ?? null)
    .catch(() => {
      pending = null; // retry next time
      return null;
    });
  return pending;
}
