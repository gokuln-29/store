import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
  poweredByHeader: false,
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "res.cloudinary.com" },
      // Placeholder images used by the demo seed.
      { protocol: "https", hostname: "picsum.photos" },
    ],
  },
};

export default withNextIntl(nextConfig);
