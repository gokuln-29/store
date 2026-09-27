import { headers } from "next/headers";

/**
 * Client IP for rate limiting. Clients can send any X-Forwarded-For they like, and proxies
 * such as Nginx append to it, so the first entry can't be trusted. Order of preference:
 * 1. X-Real-IP, set by the proxy itself (Vercel; Nginx `proxy_set_header X-Real-IP $remote_addr`)
 * 2. the X-Forwarded-For entry added by our own proxy: counted from the right, skipping
 *    TRUSTED_PROXY_HOPS - 1 further proxies (default 1 = the last entry).
 */
export function clientIpFromHeaders(
  h: Headers,
  trustedHops = Number(process.env.TRUSTED_PROXY_HOPS ?? 1),
): string {
  const realIp = h.get("x-real-ip")?.trim();
  if (realIp) return realIp;
  const chain = (h.get("x-forwarded-for") ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const hops = Number.isInteger(trustedHops) && trustedHops > 0 ? trustedHops : 1;
  return chain[Math.max(0, chain.length - hops)] ?? "unknown";
}

export async function getClientIp(): Promise<string> {
  return clientIpFromHeaders(await headers());
}
