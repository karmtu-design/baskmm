import { tr } from "@/i18n";
// Reading licence contours from GIS and CAD files: Shapefile (ArcGIS, QGIS, MapInfo export) and DXF (AutoCAD).
// Files often carry no coordinate system, so the system is guessed from the numbers and can be changed by hand.
import proj4 from "proj4";
import type { Contour } from "./types";

export type Ring = [number, number][];
export type RawPolygons = Ring[][]; // polygons → rings → points, in the file's own coordinates

/** A coordinate system a file may use. Kazakhstan: Gauss–Krüger zones 8–15 on Pulkovo-1942, UTM zones 38–46 on WGS-84. */
export type Crs = { kind: "wgs84" } | { kind: "gk"; zone: number; prefix: boolean } | { kind: "utm"; zone: number };

export const GK_ZONES = [8, 9, 10, 11, 12, 13, 14, 15];
export const UTM_ZONES = [38, 39, 40, 41, 42, 43, 44, 45, 46];
const SK42_TOWGS = "+towgs84=23.57,-140.95,-79.8,0,0.35,0.79,-0.22";

export function crsLabel(c: Crs) {
  if (c.kind === "wgs84") return tr("WGS-84, градусы");
  if (c.kind === "utm") return tr("WGS-84 / UTM, зона {0}N", { 0: c.zone });
  return tr("СК-42, Гаусс–Крюгер, зона {0}{1}", { 0: c.zone, 1: c.prefix ? " (номер зоны в начале X)" : "" });
}
export const crsKey = (c: Crs) => (c.kind === "wgs84" ? "wgs84" : c.kind === "utm" ? `utm:${c.zone}` : `gk:${c.zone}:${c.prefix ? 1 : 0}`);
export function crsFromKey(k: string): Crs {
  const [kind, a, b] = k.split(":");
  if (kind === "utm") return { kind: "utm", zone: Number(a) };
  if (kind === "gk") return { kind: "gk", zone: Number(a), prefix: b === "1" };
  return { kind: "wgs84" };
}

function projDef(c: Crs): string | null {
  if (c.kind === "wgs84") return null;
  if (c.kind === "utm") return `+proj=utm +zone=${c.zone} +datum=WGS84 +units=m +no_defs`;
  const x0 = (c.prefix ? c.zone * 1_000_000 : 0) + 500_000;
  return `+proj=tmerc +lat_0=0 +lon_0=${c.zone * 6 - 3} +k=1 +x_0=${x0} +y_0=0 +ellps=krass ${SK42_TOWGS} +units=m +no_defs`;
}

// ---------- reading files ----------

const extOf = (n: string) => (n.split(".").pop() ?? "").toLowerCase();

/** Polygons from a Shapefile: a .zip with all parts, or the .shp chosen together with .prj/.dbf. */
export async function readShapefile(files: File[]): Promise<{ polys: RawPolygons; projected: boolean }> {
  const shp = (await import("shpjs")).default;
  const zip = files.find((f) => extOf(f.name) === "zip");
  let out;
  let hasPrj = false;
  if (zip) {
    const JSZip = (await import("jszip")).default;
    const z = await JSZip.loadAsync(await zip.arrayBuffer());
    hasPrj = Object.keys(z.files).some((n) => n.toLowerCase().endsWith(".prj"));
    if (!Object.keys(z.files).some((n) => n.toLowerCase().endsWith(".shp"))) throw new Error(tr("в архиве нет файла .shp"));
    out = await shp(await zip.arrayBuffer());
  } else {
    const part = (e: string) => files.find((f) => extOf(f.name) === e);
    const s = part("shp");
    if (!s) throw new Error(tr("выберите файл .shp (вместе с .prj и .dbf) или ZIP-архив со всеми частями"));
    const prj = part("prj");
    hasPrj = !!prj;
    out = await shp({ shp: await s.arrayBuffer(), dbf: await part("dbf")?.arrayBuffer(), prj: prj ? await prj.text() : undefined });
  }
  const polys: RawPolygons = [];
  for (const fc of Array.isArray(out) ? out : [out])
    for (const f of fc.features) {
      const g = f.geometry as { type: string; coordinates: number[][][] | number[][][][] } | null;
      if (g?.type === "Polygon") polys.push(g.coordinates as Ring[]);
      if (g?.type === "MultiPolygon") (g.coordinates as Ring[][]).forEach((p) => polys.push(p));
    }
  return { polys, projected: hasPrj };
}

/** Closed polylines from an AutoCAD DXF drawing. */
export async function readDxf(file: File): Promise<RawPolygons> {
  const DxfParser = (await import("dxf-parser")).default;
  const dxf = new DxfParser().parseSync(await file.text());
  const polys: RawPolygons = [];
  for (const e of (dxf?.entities ?? []) as { type: string; vertices?: { x: number; y: number }[]; shape?: boolean; closed?: boolean }[]) {
    if ((e.type !== "LWPOLYLINE" && e.type !== "POLYLINE") || !e.vertices || e.vertices.length < 3) continue;
    const ring: Ring = e.vertices.map((v) => [v.x, v.y]);
    const [a, z] = [ring[0], ring[ring.length - 1]];
    const closed = e.shape || e.closed || (a[0] === z[0] && a[1] === z[1]);
    if (!closed) continue;
    polys.push([ring]);
  }
  return polys;
}

// ---------- coordinate systems ----------

/**
 * Guesses the system from the numbers. Returns null when it cannot tell (e.g. UTM vs Gauss–Krüger without
 * the zone number in X): then the person picks it. Also tells whether X and Y look swapped (Russian survey
 * practice writes the northing first).
 */
export function guessCrs(polys: RawPolygons): { crs: Crs | null; swapped: boolean } {
  const pts = polys.flat(2);
  if (!pts.length) return { crs: null, swapped: false };
  const xs = pts.map((p) => p[0]),
    ys = pts.map((p) => p[1]);
  const mid = (a: number[]) => a.reduce((s, v) => s + v, 0) / a.length;
  const [x, y] = [mid(xs), mid(ys)];
  if (Math.abs(x) <= 180 && Math.abs(y) <= 90) {
    // lat/lon in the wrong order: across Kazakhstan the longitude is larger than the latitude
    return { crs: { kind: "wgs84" }, swapped: x < y };
  }
  const prefixed = (v: number) => v > 7_500_000 && v < 16_000_000 && GK_ZONES.includes(Math.floor(v / 1_000_000));
  const northing = (v: number) => v > 4_000_000 && v < 6_300_000;
  if (prefixed(x) && northing(y)) return { crs: { kind: "gk", zone: Math.floor(x / 1_000_000), prefix: true }, swapped: false };
  if (prefixed(y) && northing(x)) return { crs: { kind: "gk", zone: Math.floor(y / 1_000_000), prefix: true }, swapped: true };
  if (northing(x) && y > 100_000 && y < 900_000) return { crs: null, swapped: true };
  return { crs: null, swapped: false };
}

/** Converts raw polygons to a WGS-84 contour; complains when the result is outside Kazakhstan and around. */
export function toContour(polys: RawPolygons, crs: Crs, swapped: boolean): { contour: Contour | null; warning?: string } {
  const def = projDef(crs);
  const conv = def ? proj4(def, "EPSG:4326") : null;
  const round = (v: number) => Math.round(v * 1e7) / 1e7;
  const out = polys
    .map((rings) =>
      rings
        .map((ring) => {
          const r = ring.map(([a, b]) => {
            const [px, py] = swapped ? [b, a] : [a, b];
            const [lon, lat] = conv ? conv.forward([px, py]) : [px, py];
            return [round(lon), round(lat)] as [number, number];
          });
          const [f, l] = [r[0], r[r.length - 1]];
          if (f[0] !== l[0] || f[1] !== l[1]) r.push([...f] as [number, number]);
          return r;
        })
        .filter((r) => r.length >= 4)
    )
    .filter((p) => p.length);
  if (!out.length) return { contour: null };
  const contour: Contour = out.length === 1 ? { type: "Polygon", coordinates: out[0] } : { type: "MultiPolygon", coordinates: out };
  const all = out.flat(2);
  const inside = all.every(([lon, lat]) => lon > 40 && lon < 92 && lat > 36 && lat < 58);
  return { contour, warning: inside ? undefined : tr("Контур оказался далеко за пределами Казахстана: скорее всего, выбрана не та система координат или зона.") };
}
