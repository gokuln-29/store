/** Reads a single string value from Next.js searchParams. */
export function firstParam(value: string | string[] | undefined): string | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}
