import { createHash } from "node:crypto";
import type { StorageProvider } from "./types";

type CloudinaryConfig = {
  cloudName: string;
  apiKey: string;
  apiSecret: string;
  rootFolder: string;
};

/** Cloudinary signature: SHA-1 of the sorted params plus the API secret. */
export function cloudinarySignature(params: Record<string, string>, apiSecret: string): string {
  const toSign = Object.keys(params)
    .sort()
    .map((k) => `${k}=${params[k]}`)
    .join("&");
  return createHash("sha1")
    .update(toSign + apiSecret)
    .digest("hex");
}

/** Signed uploads over the REST API (no SDK needed). */
export function createCloudinaryProvider(config: CloudinaryConfig): StorageProvider {
  const base = `https://api.cloudinary.com/v1_1/${config.cloudName}/image`;

  async function call(endpoint: "upload" | "destroy", params: Record<string, string>, file?: Blob) {
    const timestamp = String(Math.floor(Date.now() / 1000));
    const signed = { ...params, timestamp };
    const form = new FormData();
    for (const [k, v] of Object.entries(signed)) form.set(k, v);
    form.set("api_key", config.apiKey);
    form.set("signature", cloudinarySignature(signed, config.apiSecret));
    if (file) form.set("file", file);

    const res = await fetch(`${base}/${endpoint}`, { method: "POST", body: form });
    const body = (await res.json()) as Record<string, unknown>;
    if (!res.ok) {
      const message = (body.error as { message?: string } | undefined)?.message ?? res.statusText;
      throw new Error(`Cloudinary ${endpoint} failed: ${message}`);
    }
    return body;
  }

  return {
    name: "cloudinary",
    async upload({ bytes, contentType, folder }) {
      const body = await call(
        "upload",
        { folder: `${config.rootFolder}/${folder}` },
        new Blob([bytes as BlobPart], { type: contentType }),
      );
      return {
        url: String(body.secure_url),
        publicId: String(body.public_id),
        width: typeof body.width === "number" ? body.width : null,
        height: typeof body.height === "number" ? body.height : null,
      };
    },
    async delete(publicId) {
      await call("destroy", { public_id: publicId });
    },
  };
}
