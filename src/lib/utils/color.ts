/** Color helpers for the store theme (hex colors from StoreSettings). */

export const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;

function channel(value: number): number {
  const c = value / 255;
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

/** WCAG relative luminance of a #RRGGBB color. */
export function luminance(hex: string): number {
  const n = Number.parseInt(hex.slice(1), 16);
  return (
    0.2126 * channel((n >> 16) & 255) + 0.7152 * channel((n >> 8) & 255) + 0.0722 * channel(n & 255)
  );
}

export function contrastRatio(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}

/** Black or white, whichever reads better on the given background. */
export function readableForeground(background: string): "#ffffff" | "#0a0a0a" {
  return contrastRatio(background, "#ffffff") >= contrastRatio(background, "#0a0a0a")
    ? "#ffffff"
    : "#0a0a0a";
}
