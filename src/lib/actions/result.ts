import type { z } from "zod";

/** Shape returned by every server action. Errors are translation keys. */
export type ActionResult<T = undefined> =
  | { ok: true; data: T }
  | { ok: false; error: string; fieldErrors?: Record<string, string>; retryAfterSeconds?: number };

/** First error message (a translation key) per top-level field. */
export function fieldErrorsOf(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const field = String(issue.path[0] ?? "form");
    out[field] ??= issue.message;
  }
  return out;
}

export function invalid(error: z.ZodError): ActionResult<never> {
  return { ok: false, error: "validation", fieldErrors: fieldErrorsOf(error) };
}
