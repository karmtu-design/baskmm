import { createSerwistRoute } from "@serwist/turbopack";

// Builds and serves the service worker at /serwist/sw.js. Only the offline page and the app icons are
// stored in advance; everything else is cached as it is used (see src/app/sw.ts).
export const { dynamic, dynamicParams, revalidate, generateStaticParams, GET } = createSerwistRoute({
  swSrc: "src/app/sw.ts",
  useNativeEsbuild: true,
  globPatterns: ["public/icons/*.png"],
  additionalPrecacheEntries: [{ url: "/offline", revision: String(Date.now()) }],
});
