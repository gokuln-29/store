import { revalidatePath } from "next/cache";

/**
 * Refreshes every cached page after a change that can show up anywhere (catalog, content,
 * settings). Only the localized pages and the sitemap: revalidating "/" would also expire the
 * service worker route, which can't be rebuilt in the production image (no source files there).
 */
export function revalidateStorefront(): void {
  revalidatePath("/[locale]", "layout");
  revalidatePath("/sitemap.xml");
}
