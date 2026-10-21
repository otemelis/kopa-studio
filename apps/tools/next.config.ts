import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  // Keep local HMR and production validation from racing on generated route types.
  distDir:
    process.env.NODE_ENV === "development"
      ? process.env.KOPA_SIGNAL_LOCAL_READONLY === "1"
        ? ".next-real-dev"
        : ".next-dev"
      : ".next",
  outputFileTracingRoot: new URL("../..", import.meta.url).pathname,
};

export default nextConfig;
