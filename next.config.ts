import type { NextConfig } from "next";
import { withSerwist } from "@serwist/turbopack";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
  poweredByHeader: false,
  async headers() {
    return [
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

export default withSerwist(withNextIntl(nextConfig));
