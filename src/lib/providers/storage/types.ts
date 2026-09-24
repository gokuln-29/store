export type UploadFolder = "branding" | "products" | "categories" | "banners";

export type UploadInput = {
  bytes: Uint8Array;
  /** Verified by sniffing the file bytes, never taken from the client. */
  contentType: ImageContentType;
  folder: UploadFolder;
};

export type StoredFile = {
  url: string;
  /** Provider id used to delete/transform the file (Cloudinary public_id or local path). */
  publicId: string;
  width: number | null;
  height: number | null;
};

export interface StorageProvider {
  readonly name: string;
  upload(input: UploadInput): Promise<StoredFile>;
  delete(publicId: string): Promise<void>;
}

export const IMAGE_TYPES = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/avif": "avif",
  "image/x-icon": "ico",
} as const;
export type ImageContentType = keyof typeof IMAGE_TYPES;

export const MAX_UPLOAD_BYTES = 4 * 1024 * 1024;
