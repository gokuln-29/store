import type { MetadataRoute } from "next";
import { buildManifest } from "@/lib/pwa/manifest";
import { getStoreSettings } from "@/lib/services/settings.service";

// Store name, colours and logo come from the database and can change at any time.
export const dynamic = "force-dynamic";

export default async function manifest(): Promise<MetadataRoute.Manifest> {
  return buildManifest(await getStoreSettings());
}
