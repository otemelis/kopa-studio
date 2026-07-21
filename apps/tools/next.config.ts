import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  typedRoutes: true,
  outputFileTracingRoot: new URL("../..", import.meta.url).pathname,
};

export default nextConfig;
