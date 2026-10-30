import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";
import { withSerwist } from "@serwist/turbopack";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
  // keeps pages that import the design library from the package root light
  experimental: { optimizePackageImports: ["@once-ui-system/core"] },
};

export default withNextIntl(withSerwist(nextConfig));
