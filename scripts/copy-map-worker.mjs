// Copies files the browser loads by URL into /public/vendor (not kept in git; recreated on every install and build):
// the map and PDF workers, the timeline chart styles, the PT Sans font for generated PDFs, and the text-recognition engine with its Russian and English language data,
// so scans are recognised without depending on outside download sites.
import { copyFileSync, existsSync, mkdirSync } from "node:fs";
const files = [
  ["node_modules/maplibre-gl/dist/maplibre-gl-worker.mjs", "public/vendor/maplibre-gl-worker.mjs"],
  ["node_modules/pdfjs-dist/build/pdf.worker.min.mjs", "public/vendor/pdf.worker.min.mjs"],
  ["node_modules/frappe-gantt/dist/frappe-gantt.css", "public/vendor/frappe-gantt.css"],
  ["node_modules/@expo-google-fonts/pt-sans/400Regular/PTSans_400Regular.ttf", "public/vendor/fonts/PTSans-Regular.ttf"],
  ["node_modules/@expo-google-fonts/pt-sans/700Bold/PTSans_700Bold.ttf", "public/vendor/fonts/PTSans-Bold.ttf"],
  ["node_modules/tesseract.js/dist/worker.min.js", "public/vendor/tesseract/worker.min.js"],
  ["node_modules/tesseract.js-core/tesseract-core-lstm.wasm.js", "public/vendor/tesseract/tesseract-core-lstm.wasm.js"],
  ["node_modules/tesseract.js-core/tesseract-core-simd-lstm.wasm.js", "public/vendor/tesseract/tesseract-core-simd-lstm.wasm.js"],
  ["node_modules/tesseract.js-core/tesseract-core-relaxedsimd-lstm.wasm.js", "public/vendor/tesseract/tesseract-core-relaxedsimd-lstm.wasm.js"],
  ["node_modules/@tesseract.js-data/rus/4.0.0_best_int/rus.traineddata.gz", "public/vendor/tesseract/lang/rus.traineddata.gz"],
  ["node_modules/@tesseract.js-data/eng/4.0.0_best_int/eng.traineddata.gz", "public/vendor/tesseract/lang/eng.traineddata.gz"],
  // GDAL for reading MapInfo and GeoPackage files in the browser (loaded only when such a file is chosen)
  ["node_modules/gdal3.js/dist/package/gdal3.js", "public/vendor/gdal/gdal3.js"],
  ["node_modules/gdal3.js/dist/package/gdal3WebAssembly.wasm", "public/vendor/gdal/gdal3WebAssembly.wasm"],
  ["node_modules/gdal3.js/dist/package/gdal3WebAssembly.data", "public/vendor/gdal/gdal3WebAssembly.data"],
];
mkdirSync("public/vendor/gdal", { recursive: true });
mkdirSync("public/vendor/tesseract/lang", { recursive: true });
mkdirSync("public/vendor/fonts", { recursive: true });
for (const [from, to] of files) if (existsSync(from)) copyFileSync(from, to);
