import type { z } from "zod";

/** Shape returned by every server action. Errors are translation keys. */
export type ActionResult<T = undefined> =
  | { ok: true; data: T }
  | { ok: false; error: string; fieldErrors?: Record<string, string>; retryAfterSeconds?: number };

/**
 * First error message (a translation key) per field. By default keyed by the top-level
 * field; with `nested`, by the full dotted path (e.g. "variants.2.sku").
 */
export function fieldErrorsOf(
  error: z.ZodError,
  opts: { nested?: boolean } = {},
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const field = opts.nested
      ? issue.path.map(String).join(".") || "form"
      : String(issue.path[0] ?? "form");
    out[field] ??= issue.message;
  }
  return out;
}

export function invalid(error: z.ZodError, opts: { nested?: boolean } = {}): ActionResult<never> {
  return { ok: false, error: "validation", fieldErrors: fieldErrorsOf(error, opts) };
}
