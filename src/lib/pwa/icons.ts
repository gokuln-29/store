import { readFile } from "node:fs/promises";
import sharp from "sharp";
import { resolveLocalUpload } from "@/lib/providers/storage/local";
import { ICONS, type IconName, type IconSource } from "./icon-meta";

/**
 * App icons generated from the store logo (or a shopping-bag glyph in the brand colour when
 * there is no logo). No fonts are needed, so this works in slim server images too.
 */

export { ICONS, iconVersion, isIconName, type IconName, type IconSource } from "./icon-meta";
type IconKind = (typeof ICONS)[IconName]["kind"];

const HEX = /^#[0-9a-f]{6}$/i;
const REMOTE_HOSTS = new Set(["res.cloudinary.com", "picsum.photos"]);
const MAX_LOGO_BYTES = 5 * 1024 * 1024;

/** Reads the logo from local uploads or an allowed image host; null if unavailable. */
export async function loadLogo(logoUrl: string | null): Promise<Buffer | null> {
  if (!logoUrl) return null;
  try {
    if (logoUrl.startsWith("/uploads/")) {
      const file = resolveLocalUpload(decodeURIComponent(logoUrl.slice("/uploads/".length)));
      return file ? await readFile(file) : null;
    }
    const url = new URL(logoUrl);
    if (url.protocol !== "https:" || !REMOTE_HOSTS.has(url.hostname)) return null;
    const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) return null;
    const bytes = Buffer.from(await res.arrayBuffer());
    return bytes.length <= MAX_LOGO_BYTES ? bytes : null;
  } catch {
    return null;
  }
}

function bagSvg(size: number, color: string, background: string | null, scale: number): Buffer {
  const glyph = size * scale;
  const offset = (size - glyph) / 2;
  const s = glyph / 24; // lucide icons use a 24×24 grid
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">
  ${background ? `<rect width="100%" height="100%" fill="${background}"/>` : ""}
  <g transform="translate(${offset} ${offset}) scale(${s})" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <path d="M16 10a4 4 0 0 1-8 0"/><path d="M3.103 6.034h17.794"/>
    <path d="M3.4 5.467a2 2 0 0 0-.4 1.2V20a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6.667a2 2 0 0 0-.4-1.2l-2-2.667A2 2 0 0 0 17 2H7a2 2 0 0 0-1.6.8z"/>
  </g></svg>`);
}

/**
 * Renders one icon as PNG.
 * - any: logo on white with a small margin
 * - maskable: content inside the central safe zone (launchers crop to circles/squircles)
 * - apple: opaque (iOS shows transparency as black)
 * - badge: white glyph on transparent (Android status bar uses only the alpha channel)
 * - logo: the logo itself on transparent, for the storefront header and footer
 */
export async function renderIcon(
  name: IconName,
  source: IconSource,
  logo: Buffer | null,
): Promise<Buffer> {
  const { size, kind } = ICONS[name];
  const primary = HEX.test(source.primaryColor) ? source.primaryColor : "#111827";
  if (kind === "badge")
    return sharp(bagSvg(size, "#ffffff", null, 0.75))
      .png()
      .toBuffer();
  if (kind === "logo") {
    if (logo) {
      try {
        return await sharp(logo)
          .resize(size, size, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
          .png({ palette: true, quality: 90 })
          .toBuffer();
      } catch {
        // Not a readable image: fall back to the glyph.
      }
    }
    return sharp(bagSvg(size, primary, null, 0.9))
      .png()
      .toBuffer();
  }

  const scale: Record<Exclude<IconKind, "badge" | "logo">, number> = {
    any: 0.84,
    maskable: 0.6,
    apple: 0.8,
  };
  const inner = Math.round(size * scale[kind]);
  if (logo) {
    try {
      const fitted = await sharp(logo)
        .resize(inner, inner, { fit: "contain", background: { r: 255, g: 255, b: 255, alpha: 0 } })
        .png()
        .toBuffer();
      return await sharp({
        create: { width: size, height: size, channels: 4, background: "#ffffff" },
      })
        .composite([{ input: fitted, gravity: "center" }])
        .png()
        .toBuffer();
    } catch {
      // Not a readable image: fall back to the glyph.
    }
  }
  return sharp(bagSvg(size, "#ffffff", primary, scale[kind] * 0.75))
    .png()
    .toBuffer();
}
