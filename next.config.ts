import type { NextConfig } from "next";
import { withSerwist } from "@serwist/turbopack";

const nextConfig: NextConfig = {
  // keeps pages that import the design library from the package root light
  experimental: { optimizePackageImports: ["@once-ui-system/core"] },
};

export default withSerwist(nextConfig);
