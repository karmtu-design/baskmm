// Copies the map library's background worker into /public so the browser can load it by URL.
import { copyFileSync, existsSync, mkdirSync } from "node:fs";
const from = "node_modules/maplibre-gl/dist/maplibre-gl-worker.mjs";
if (existsSync(from)) {
  mkdirSync("public/vendor", { recursive: true });
  copyFileSync(from, "public/vendor/maplibre-gl-worker.mjs");
}
