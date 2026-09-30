import { iconVersion } from "@/lib/pwa/icons";
import { getStoreSettings } from "@/lib/services/settings.service";

export const dynamic = "force-dynamic";

/**
 * Browsers, bookmarks and crawlers still ask for /favicon.ico. Send them to the store's favicon
 * (Settings → Branding), or to the icon generated from the logo when none is set.
 */
export async function GET(request: Request) {
  const settings = await getStoreSettings();
  const target = settings.faviconUrl ?? `/icons/icon-192.png?v=${iconVersion(settings)}`;
  return new Response(null, {
    status: 307,
    headers: {
      Location: new URL(target, request.url).toString(),
      "Cache-Control": "public, max-age=3600",
    },
  });
}
