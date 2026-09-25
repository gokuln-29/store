import { randomUUID } from "node:crypto";
import { mkdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { IMAGE_TYPES, type StorageProvider } from "./types";

// Runtime directory, not part of the build output (turbopackIgnore stops whole-project tracing).
export const LOCAL_UPLOAD_DIR = path.resolve(
  /*turbopackIgnore: true*/ process.env.UPLOAD_DIR ?? "uploads",
);

/** Resolves a public id to a path inside the upload dir, rejecting path traversal. */
export function resolveLocalUpload(publicId: string): string | null {
  const full = path.resolve(LOCAL_UPLOAD_DIR, publicId);
  return full.startsWith(LOCAL_UPLOAD_DIR + path.sep) ? full : null;
}

/** Development storage: files go to ./uploads and are served by /uploads/[...path]. */
export const localStorageProvider: StorageProvider = {
  name: "local",
  async upload({ bytes, contentType, folder }) {
    const publicId = `${folder}/${randomUUID()}.${IMAGE_TYPES[contentType]}`;
    const target = resolveLocalUpload(publicId);
    if (!target) throw new Error("Invalid upload path");
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, bytes);
    return { url: `/uploads/${publicId}`, publicId, width: null, height: null };
  },
  async delete(publicId) {
    const target = resolveLocalUpload(publicId);
    if (target) await unlink(target).catch(() => undefined);
  },
};
