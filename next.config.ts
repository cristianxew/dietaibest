import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin();

const nextConfig: NextConfig = {
  output: "standalone",
  // Explicitly include ws module for routes that use Supabase
  // Required because @supabase/realtime-js transitively requires 'ws'
  // and standalone mode doesn't automatically trace this dependency
  outputFileTracingIncludes: {
    "/api/auth/[...nextauth]": ["./node_modules/ws/**/*"],
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
