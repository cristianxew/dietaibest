import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin();

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      // new URL("https://www.allrecipes.com/**"),
      new URL("https://images.unsplash.com/**"),
    ],
  },
  /* config options here */
};

export default withNextIntl(nextConfig);
