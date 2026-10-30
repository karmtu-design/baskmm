// Copies files the browser loads by URL into /public/vendor (not kept in git; recreated on every install and build):
// the map and PDF workers, and the text-recognition engine with its Russian and English language data,
// so scans are recognised without depending on outside download sites.
import { copyFileSync, existsSync, mkdirSync } from "node:fs";
const files = [
  ["node_modules/maplibre-gl/dist/maplibre-gl-worker.mjs", "public/vendor/maplibre-gl-worker.mjs"],
  ["node_modules/pdfjs-dist/build/pdf.worker.min.mjs", "public/vendor/pdf.worker.min.mjs"],
  ["node_modules/tesseract.js/dist/worker.min.js", "public/vendor/tesseract/worker.min.js"],
  ["node_modules/tesseract.js-core/tesseract-core-lstm.wasm.js", "public/vendor/tesseract/tesseract-core-lstm.wasm.js"],
  ["node_modules/tesseract.js-core/tesseract-core-simd-lstm.wasm.js", "public/vendor/tesseract/tesseract-core-simd-lstm.wasm.js"],
  ["node_modules/tesseract.js-core/tesseract-core-relaxedsimd-lstm.wasm.js", "public/vendor/tesseract/tesseract-core-relaxedsimd-lstm.wasm.js"],
  ["node_modules/@tesseract.js-data/rus/4.0.0_best_int/rus.traineddata.gz", "public/vendor/tesseract/lang/rus.traineddata.gz"],
  ["node_modules/@tesseract.js-data/eng/4.0.0_best_int/eng.traineddata.gz", "public/vendor/tesseract/lang/eng.traineddata.gz"],
];
mkdirSync("public/vendor/tesseract/lang", { recursive: true });
for (const [from, to] of files) if (existsSync(from)) copyFileSync(from, to);
