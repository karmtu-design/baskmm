import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // keeps pages that import the design library from the package root light
  experimental: { optimizePackageImports: ["@once-ui-system/core"] },
};

export default nextConfig;
