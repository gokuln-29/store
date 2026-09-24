/** Files served by our own /uploads route are already final; skip Next's optimizer for them. */
export function isLocalUpload(url: string): boolean {
  return url.startsWith("/uploads/");
}
