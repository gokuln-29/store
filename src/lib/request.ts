import { headers } from "next/headers";

/**
 * Best-effort client IP for rate limiting. Behind a proxy (Vercel, Nginx) the first
 * x-forwarded-for entry is the client. Make sure your proxy overwrites this header.
 */
export function clientIpFromHeaders(h: Headers): string {
  const forwarded = h.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || h.get("x-real-ip") || "unknown";
}

export async function getClientIp(): Promise<string> {
  return clientIpFromHeaders(await headers());
}
