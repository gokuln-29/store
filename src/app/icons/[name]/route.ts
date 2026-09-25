import { iconVersion, isIconName, loadLogo, renderIcon } from "@/lib/pwa/icons";
import { getStoreSettings } from "@/lib/services/settings.service";

export const dynamic = "force-dynamic";

// Rendered icons per version (logo + colour), so sharp runs once per change.
const cache = new Map<string, Buffer>();

/** App icons from the store logo: /icons/icon-192.png, /icons/maskable-512.png, … */
export async function GET(request: Request, ctx: RouteContext<"/icons/[name]">) {
  const { name } = await ctx.params;
  if (!isIconName(name)) return new Response("Not found", { status: 404 });
  const settings = await getStoreSettings();
  const version = iconVersion(settings);
  const key = `${name}:${version}`;
  let png = cache.get(key);
  if (!png) {
    png = await renderIcon(name, settings, await loadLogo(settings.logoUrl));
    if (cache.size > 50) cache.clear();
    cache.set(key, png);
  }
  // Versioned URLs (?v=…) never change; unversioned ones are rechecked daily.
  const current = new URL(request.url).searchParams.get("v") === version;
  return new Response(new Uint8Array(png), {
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": current
        ? "public, max-age=31536000, immutable"
        : "public, max-age=86400, stale-while-revalidate=604800",
    },
  });
}
