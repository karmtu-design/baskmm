/// <reference lib="webworker" />
// The service worker of the installed app. It keeps the app's own files (code, styles, fonts, logo)
// on the device so it opens fast, and shows a simple offline page without a network.
// Pages and data are NOT stored on the device: licence data always comes fresh from the server.
import { CacheFirst, ExpirationPlugin, NetworkOnly, Serwist, StaleWhileRevalidate, type PrecacheEntry, type SerwistGlobalConfig } from "serwist";

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}
declare const self: ServiceWorkerGlobalScope;

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: [
    {
      // code and styles of the app: the file names change with every release
      matcher: ({ url, sameOrigin }) => sameOrigin && url.pathname.startsWith("/_next/static/"),
      handler: new CacheFirst({ cacheName: "bask-static", plugins: [new ExpirationPlugin({ maxEntries: 400, maxAgeSeconds: 60 * 24 * 3600 })] }),
    },
    {
      // logo, icons, fonts, map and PDF workers
      matcher: ({ url, sameOrigin }) => sameOrigin && /^\/(brand|icons|vendor\/fonts|vendor\/pdf|vendor\/maplibre)/.test(url.pathname),
      handler: new StaleWhileRevalidate({ cacheName: "bask-assets", plugins: [new ExpirationPlugin({ maxEntries: 80, maxAgeSeconds: 30 * 24 * 3600 })] }),
    },
    {
      // map tiles from public map servers: kept for a week, so recently viewed areas open faster
      matcher: ({ url }) => /tile\.openstreetmap\.org|arcgisonline\.com|opentopomap\.org|elevation-tiles-prod/.test(url.hostname),
      handler: new CacheFirst({ cacheName: "bask-tiles", plugins: [new ExpirationPlugin({ maxEntries: 1500, maxAgeSeconds: 7 * 24 * 3600 })] }),
    },
    {
      // pages: always from the network; without it, the offline page
      matcher: ({ request }) => request.mode === "navigate",
      handler: new NetworkOnly(),
    },
  ],
  fallbacks: {
    entries: [{ url: "/offline", matcher: ({ request }) => request.destination === "document" }],
  },
});

serwist.addEventListeners();
