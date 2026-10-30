"use client";

import { tr } from "@/i18n";
// Getting searchable text out of documents, in the browser of the person who uploads them.
// PDF with a text layer → PDF.js; scanned PDF pages and photos → Tesseract.js (Russian + English);
// Word (.docx) and Excel (.xlsx) → read straight from the file. Nothing leaves the browser except the text.
import type { PDFDocumentProxy } from "pdfjs-dist";

export const MAX_TEXT_CHARS = 800_000; // about 300 pages of dense text
export const MAX_OCR_PAGES = 40; // a scan takes a few seconds per page

let pdfjsPromise: Promise<typeof import("pdfjs-dist")> | null = null;
/** PDF.js, loaded only when a PDF is opened; its worker is served from /vendor. */
export function loadPdfjs() {
  pdfjsPromise ??= import("pdfjs-dist").then((m) => {
    m.GlobalWorkerOptions.workerSrc = "/vendor/pdf.worker.min.mjs";
    return m;
  });
  return pdfjsPromise;
}

export async function openPdf(data: ArrayBuffer | string): Promise<PDFDocumentProxy> {
  const pdfjs = await loadPdfjs();
  const task = typeof data === "string" ? pdfjs.getDocument({ url: data }) : pdfjs.getDocument({ data: new Uint8Array(data) });
  return task.promise;
}

export type Progress = (done: number, total: number, stage: "text" | "ocr") => void;
export type Extracted = { text: string; pages: number | null; status: "done" | "ocr" | "unsupported" | "failed"; note?: string };

const extOf = (name: string) => (name.split(".").pop() ?? "").toLowerCase();
const tidy = (s: string) => s.replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim().slice(0, MAX_TEXT_CHARS);

export async function extractText(file: Blob, fileName: string, opts: { ocr: boolean; onProgress?: Progress }): Promise<Extracted> {
  const ext = extOf(fileName);
  try {
    if (ext === "pdf") return await fromPdf(await file.arrayBuffer(), opts);
    if (["png", "jpg", "jpeg", "tif", "tiff", "bmp", "webp"].includes(ext)) {
      if (!opts.ocr) return { text: "", pages: 1, status: "unsupported", note: tr("распознавание выключено") };
      const text = await ocr([file], opts.onProgress);
      return { text: tidy(text), pages: 1, status: "ocr" };
    }
    if (ext === "docx") return { text: tidy(await fromDocx(file)), pages: null, status: "done" };
    if (ext === "xlsx") return { text: tidy(await fromXlsx(file)), pages: null, status: "done" };
    if (ext === "txt" || ext === "csv") return { text: tidy(await file.text()), pages: null, status: "done" };
    return { text: "", pages: null, status: "unsupported", note: tr("текст из файлов этого типа не извлекается") };
  } catch (e) {
    return { text: "", pages: null, status: "failed", note: (e as Error).message };
  }
}

async function fromPdf(data: ArrayBuffer, opts: { ocr: boolean; onProgress?: Progress }): Promise<Extracted> {
  const pdf = await openPdf(data);
  const n = pdf.numPages;
  const parts: string[] = [];
  const emptyPages: number[] = [];
  for (let i = 1; i <= n; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    let line = "";
    for (const item of content.items) {
      if (!("str" in item)) continue;
      line += item.str + (item.hasEOL ? "\n" : " ");
    }
    if (line.replace(/\s/g, "").length < 40) emptyPages.push(i);
    parts.push(line);
    opts.onProgress?.(i, n, "text");
    if (parts.join("").length > MAX_TEXT_CHARS) break;
  }
  // mostly scanned pages: read them with OCR (up to MAX_OCR_PAGES)
  if (opts.ocr && emptyPages.length > n / 2) {
    const pages = emptyPages.slice(0, MAX_OCR_PAGES);
    const images: Blob[] = [];
    for (const i of pages) images.push(await renderPage(pdf, i, 2));
    const text = await ocr(images, opts.onProgress);
    const note = emptyPages.length > MAX_OCR_PAGES ? tr("распознаны первые {0} страниц скана из {1}", { 0: MAX_OCR_PAGES, 1: emptyPages.length }) : undefined;
    return { text: tidy(parts.join("\n") + "\n" + text), pages: n, status: "ocr", note };
  }
  const text = tidy(parts.join("\n"));
  if (!text && !opts.ocr) return { text: "", pages: n, status: "unsupported", note: tr("это скан без текстового слоя") };
  return { text, pages: n, status: "done" };
}

export async function renderPage(pdf: PDFDocumentProxy, n: number, scale: number): Promise<Blob> {
  const page = await pdf.getPage(n);
  const vp = page.getViewport({ scale });
  const canvas = document.createElement("canvas");
  canvas.width = Math.floor(vp.width);
  canvas.height = Math.floor(vp.height);
  await page.render({ canvas, viewport: vp }).promise;
  return new Promise((res, rej) => canvas.toBlob((b) => (b ? res(b) : rej(new Error(tr("страница не отрисовалась")))), "image/png"));
}

export async function ocr(images: Blob[], onProgress?: Progress): Promise<string> {
  const { createWorker } = await import("tesseract.js");
  // the engine and language data are served by the site itself (see scripts/copy-map-worker.mjs)
  const worker = await createWorker(["rus", "eng"], 1, {
    workerPath: "/vendor/tesseract/worker.min.js",
    corePath: "/vendor/tesseract",
    langPath: "/vendor/tesseract/lang",
    gzip: true,
  });
  try {
    const out: string[] = [];
    for (let i = 0; i < images.length; i++) {
      onProgress?.(i, images.length, "ocr");
      const { data } = await worker.recognize(images[i]);
      out.push(data.text);
    }
    onProgress?.(images.length, images.length, "ocr");
    return out.join("\n\n");
  } finally {
    await worker.terminate();
  }
}

async function fromDocx(file: Blob): Promise<string> {
  const JSZip = (await import("jszip")).default;
  const zip = await JSZip.loadAsync(await file.arrayBuffer());
  const xml = (await zip.file("word/document.xml")?.async("string")) ?? "";
  return xml
    .replace(/<\/w:p>/g, "\n")
    .replace(/<w:tab\/>/g, "\t")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}

async function fromXlsx(file: Blob): Promise<string> {
  const ExcelJS = (await import("exceljs")).default;
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(await file.arrayBuffer());
  const lines: string[] = [];
  wb.eachSheet((ws) => {
    lines.push(`# ${ws.name}`);
    ws.eachRow((row) => {
      const cells = (row.values as unknown[]).slice(1).map((v) => {
        if (v == null) return "";
        if (typeof v === "object") {
          const o = v as { text?: string; result?: unknown; richText?: { text: string }[] };
          return o.richText ? o.richText.map((r) => r.text).join("") : String(o.text ?? o.result ?? "");
        }
        return String(v);
      });
      lines.push(cells.join("\t"));
    });
  });
  return lines.join("\n");
}
