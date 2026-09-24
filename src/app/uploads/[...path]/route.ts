import { readFile } from "node:fs/promises";
import path from "node:path";
import { resolveLocalUpload } from "@/lib/providers/storage/local";

const TYPES: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".avif": "image/avif",
  ".ico": "image/x-icon",
};

/** Serves files saved by the local storage provider (development / single-server installs). */
export async function GET(_request: Request, { params }: RouteContext<"/uploads/[...path]">) {
  const { path: segments } = await params;
  const file = resolveLocalUpload(segments.join("/"));
  const type = file ? TYPES[path.extname(file).toLowerCase()] : undefined;
  if (!file || !type) return new Response("Not found", { status: 404 });
  try {
    const body = await readFile(file);
    return new Response(body, {
      headers: {
        "Content-Type": type,
        "Cache-Control": "public, max-age=31536000, immutable",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
