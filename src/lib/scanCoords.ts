"use client";

// Reading the corner points of a licence from its scanned appendix (PDF or photo): the text is recognised
// in the browser (Tesseract, as for documents), then coordinates are picked out of it. The result is put
// into the «Угловые точки» box for the person to compare with the paper before showing it on the map.
import { tr } from "@/i18n";
import type { CoordSystem } from "./coords";

export type FoundPoint = { lat: number; lon: number; latText: string; lonText: string };
export type ScanResult = { points: FoundPoint[]; system: CoordSystem | null; text: string };

const MAX_PAGES = 6;

/** Text of the file: the PDF's own text where there is one, otherwise recognition of the page images. */
async function textOf(file: File, onStep: (s: string) => void): Promise<string> {
  const { openPdf, renderPage, ocr } = await import("./docText");
  const isPdf = /\.pdf$/i.test(file.name) || file.type === "application/pdf";
  if (!isPdf) {
    onStep(tr("распознаю картинку…"));
    return ocr([file], (d, t) => onStep(tr("распознаю: {0} из {1}", { 0: Math.min(d + 1, t), 1: t })));
  }
  const pdf = await openPdf(await file.arrayBuffer());
  const n = Math.min(pdf.numPages, MAX_PAGES);
  let own = "";
  for (let i = 1; i <= n; i++) {
    const c = await (await pdf.getPage(i)).getTextContent();
    for (const it of c.items) if ("str" in it) own += it.str + (it.hasEOL ? "\n" : " ");
    own += "\n";
  }
  if (parse(own).length >= 3) return own;
  const images: Blob[] = [];
  for (let i = 1; i <= n; i++) {
    onStep(tr("готовлю страницу {0} из {1}…", { 0: i, 1: n }));
    // a larger picture recognises small digits in tables better
    images.push(await renderPage(pdf, i, 3));
  }
  return ocr(images, (d, t) => onStep(tr("распознаю страницу {0} из {1}…", { 0: Math.min(d + 1, t), 1: t })));
}

/** Typical recognition slips in numbers: «О» for 0, «l» for 1, «З» for 3, odd quote marks. */
function normalise(s: string): string {
  return s
    .replace(/(?<=\d)[OoОо](?=[\d"'’′″”])/g, "0")
    .replace(/(?<=\d)[lI|](?=\d)/g, "1")
    .replace(/(?<=\d)[З](?=\d)/g, "3")
    .replace(/[º˚°]|(?<=\d)\s*[oо](?=\s*\d{1,2}\s*['’′`´])/g, "°")
    .replace(/['’′`´]{2}|[“”″]/g, '"')
    .replace(/[’′`´]/g, "'")
    .replace(/(\d)\s*,\s*(\d)/g, "$1.$2");
}

// 49°37'12.5"  /  49° 37' 12,5''  /  49 37 12.5 (three numbers with marks missing)
// and «49°3520"», where recognition lost the minutes mark
const DMS = /(\d{2})\s*°\s*(\d{1,2})\s*'\s*(\d{1,2}(?:\.\d+)?)\s*"?|(\d{2})\s*°\s*(\d{2})\s*(\d{2}(?:\.\d+)?)\s*"|(\d{2})\s*°\s*(\d{1,2}(?:\.\d+)?)\s*'/g;
const DEC = /(?<![\d.])(\d{2}\.\d{4,8})(?![\d.])/g;

type Val = { v: number; text: string; at: number };

function values(line: string): Val[] {
  const out: Val[] = [];
  for (const m of line.matchAll(DMS)) {
    const d = Number(m[1] ?? m[4] ?? m[7]),
      mi = Number(m[2] ?? m[5] ?? m[8]),
      se = m[3] != null ? Number(m[3]) : m[6] != null ? Number(m[6]) : 0;
    if (mi >= 60 || se >= 60) continue;
    out.push({ v: d + mi / 60 + se / 3600, text: m[0].trim(), at: m.index! });
  }
  if (out.length < 2)
    for (const m of line.matchAll(DEC)) out.push({ v: Number(m[1]), text: m[1], at: m.index! });
  return out.sort((a, b) => a.at - b.at);
}

// Kazakhstan: latitude 40.5–55.5, longitude 46.5–87.5
const isLat = (v: number) => v >= 40 && v <= 56;
const isLon = (v: number) => v >= 46 && v <= 88;

/** Corner points in the order they are written: a line with a latitude and a longitude is one point. */
export function parse(raw: string): FoundPoint[] {
  const pts: FoundPoint[] = [];
  const lines = normalise(raw).split(/\r?\n/);
  const loose: Val[] = [];
  for (const line of lines) {
    const vs = values(line);
    if (vs.length >= 2) {
      // a line can hold several points (two-column tables): take them two by two
      for (let i = 0; i + 1 < vs.length; i += 2) {
        let [a, b] = [vs[i], vs[i + 1]];
        // longitude first is rare but happens; Kazakhstan longitudes over 56 make it clear
        if (!isLat(a.v) && isLat(b.v)) [a, b] = [b, a];
        if (isLat(a.v) && isLon(b.v)) pts.push({ lat: a.v, lon: b.v, latText: a.text, lonText: b.text });
      }
    } else if (vs.length === 1) loose.push(vs[0]);
  }
  // tables read column by column: latitudes and longitudes on separate lines, in turn
  if (pts.length < 3 && loose.length >= 6) {
    for (let i = 0; i + 1 < loose.length; i += 2) {
      const [a, b] = [loose[i], loose[i + 1]];
      if (isLat(a.v) && isLon(b.v)) pts.push({ lat: a.v, lon: b.v, latText: a.text, lonText: b.text });
    }
  }
  // the same point printed twice (closing point, page repeats) is kept once
  return pts.filter((p, i) => pts.findIndex((q) => Math.abs(q.lat - p.lat) < 1e-6 && Math.abs(q.lon - p.lon) < 1e-6) === i);
}

export function systemIn(text: string): CoordSystem | null {
  if (/СК[\s-]*42|SK[\s-]*42|Пулков|Pulkovo|1942/i.test(text)) return "sk42";
  if (/WGS[\s-]*84|ГСК[\s-]*2011/i.test(text)) return "wgs84";
  return null;
}

export async function readCornersFromScan(file: File, onStep: (s: string) => void): Promise<ScanResult> {
  const text = await textOf(file, onStep);
  return { points: parse(text), system: systemIn(text), text };
}

/** The points as lines for the «Угловые точки» box: «1. 49°37'12" 80°31'05"». */
export function pointsAsText(points: FoundPoint[]): string {
  const dms = (v: number) => {
    const d = Math.floor(v),
      mf = (v - d) * 60,
      m = Math.floor(mf),
      s = Math.round((mf - m) * 60 * 100) / 100;
    return s >= 60 ? `${d}°${m + 1}'0"` : `${d}°${m}'${s}"`;
  };
  return points.map((p, i) => `${i + 1}. ${dms(p.lat)} ${dms(p.lon)}`).join("\n");
}
