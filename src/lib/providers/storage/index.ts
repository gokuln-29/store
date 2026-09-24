import { createCloudinaryProvider } from "./cloudinary";
import { localStorageProvider } from "./local";
import type { StorageProvider } from "./types";

export * from "./types";
export { sniffImageType } from "./sniff";

let warned = false;

/** Cloudinary when CLOUDINARY_* are set, otherwise local disk (development). */
export function getStorageProvider(): StorageProvider {
  const { CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET } = process.env;
  if (CLOUDINARY_CLOUD_NAME && CLOUDINARY_API_KEY && CLOUDINARY_API_SECRET) {
    return createCloudinaryProvider({
      cloudName: CLOUDINARY_CLOUD_NAME,
      apiKey: CLOUDINARY_API_KEY,
      apiSecret: CLOUDINARY_API_SECRET,
      rootFolder: process.env.CLOUDINARY_FOLDER || "store",
    });
  }
  if (process.env.NODE_ENV === "production" && !warned) {
    warned = true;
    console.warn(
      "[storage] CLOUDINARY_* not set: using local disk. Files are lost on redeploy unless UPLOAD_DIR is a persistent volume.",
    );
  }
  return localStorageProvider;
}
