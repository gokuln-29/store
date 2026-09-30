import { withSentryConfig } from "@sentry/nextjs/config";
import type { NextConfig } from "next";
import { withSerwist } from "@serwist/turbopack";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");
const isDev = process.env.NODE_ENV !== "production";

/**
 * Content Security Policy. Static-friendly: inline scripts are allowed because Next.js inlines
 * its bootstrap without nonces (a nonce would make every page dynamic); everything else is
 * locked to our own origin plus the few services the store uses (Razorpay checkout, Cloudinary
 * images, Google Fonts). See docs/security-checklist.md.
 */
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""} https://checkout.razorpay.com`,
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' data: https://fonts.gstatic.com",
  "img-src 'self' data: blob: https://res.cloudinary.com https://images.unsplash.com https://picsum.photos https://*.razorpay.com",
  `connect-src 'self' https://*.razorpay.com${isDev ? " ws: http://localhost:*" : ""}`,
  "frame-src https://api.razorpay.com https://checkout.razorpay.com",
  "worker-src 'self'",
  "manifest-src 'self'",
  "media-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  ...(isDev ? [] : ["upgrade-insecure-requests"]),
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value:
      'camera=(), microphone=(), geolocation=(), browsing-topics=(), payment=(self "https://api.razorpay.com")',
  },
  // Razorpay may open a popup (UPI apps, bank 3-D Secure) that must be able to reply.
  { key: "Cross-Origin-Opener-Policy", value: "same-origin-allow-popups" },
  ...(isDev
    ? []
    : [{ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" }]),
];

const nextConfig: NextConfig = {
  // The Docker image runs the self-contained server (see Dockerfile); `next start` and Vercel
  // use the regular output.
  output: process.env.NEXT_OUTPUT === "standalone" ? "standalone" : undefined,
  poweredByHeader: false,
  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
      {
        // Browsers must always check for a new service worker.
        source: "/serwist/:path*",
        headers: [{ key: "Cache-Control", value: "no-cache" }],
      },
    ];
  },
  images: {
    // AVIF is ~20% smaller than WebP; uploads have unique names, so long caching is safe.
    formats: ["image/avif", "image/webp"],
    // Next.js 16 only serves listed qualities: 75 is the default, 60 is used for hero banners.
    qualities: [60, 75],
    minimumCacheTTL: 60 * 60 * 24 * 30,
    remotePatterns: [
      { protocol: "https", hostname: "res.cloudinary.com" },
      // Demo seed photos (Unsplash) and placeholders.
      { protocol: "https", hostname: "images.unsplash.com" },
      { protocol: "https", hostname: "picsum.photos" },
    ],
  },
};

export default withSentryConfig(withSerwist(withNextIntl(nextConfig)), {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,
  // Source maps are uploaded only when an auth token is configured.
  sourcemaps: { disable: !process.env.SENTRY_AUTH_TOKEN },
  // Browser errors go to /monitoring on our own domain (not blocked by ad blockers or the CSP).
  tunnelRoute: "/monitoring",
  silent: !process.env.CI,
  telemetry: false,
});
