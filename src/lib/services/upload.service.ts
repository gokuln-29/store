import {
  getStorageProvider,
  MAX_UPLOAD_BYTES,
  sniffImageType,
  type StoredFile,
  type UploadFolder,
} from "@/lib/providers/storage";

export type UploadResult =
  | { ok: true; file: StoredFile }
  | { ok: false; error: "file_too_large" | "file_type" | "file_empty" };

/** Validates an uploaded image by size and real content, then stores it. */
export async function uploadImage(file: File, folder: UploadFolder): Promise<UploadResult> {
  if (file.size === 0) return { ok: false, error: "file_empty" };
  if (file.size > MAX_UPLOAD_BYTES) return { ok: false, error: "file_too_large" };
  const bytes = new Uint8Array(await file.arrayBuffer());
  const contentType = sniffImageType(bytes);
  if (!contentType) return { ok: false, error: "file_type" };
  // Favicons may be .ico; everywhere else only web image formats.
  if (contentType === "image/x-icon" && folder !== "branding")
    return { ok: false, error: "file_type" };
  return { ok: true, file: await getStorageProvider().upload({ bytes, contentType, folder }) };
}
