import { withSentryConfig } from "@sentry/nextjs";
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
  "img-src 'self' data: blob: https://res.cloudinary.com https://picsum.photos https://*.razorpay.com",
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
    remotePatterns: [
      { protocol: "https", hostname: "res.cloudinary.com" },
      // Placeholder images used by the demo seed.
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
