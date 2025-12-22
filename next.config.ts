import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin();

const nextConfig: NextConfig = {
  output: "standalone",
  // Explicitly include ws module for all routes
  // Required because @supabase/realtime-js transitively requires 'ws'
  // and standalone mode doesn't automatically trace this dependency
  // Using '/*' ensures the module is included in the standalone build
  outputFileTracingIncludes: {
    "/*": ["./node_modules/ws/**/*"],
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**",
        port: "",
        pathname: "**",
      },
    ],
  },
  /* config options here */
};

export default withNextIntl(nextConfig);
