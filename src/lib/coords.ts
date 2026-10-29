import proj4 from "proj4";
import area from "@turf/area";
import type { Contour, Polygon } from "./types";

/** Pulkovo-1942 (СК-42), Krassovsky ellipsoid, standard GOST 51794 parameters to WGS-84. */
const SK42 = "+proj=longlat +ellps=krass +towgs84=23.57,-140.95,-79.8,0,0.35,0.79,-0.22 +no_defs";
const WGS84 = "EPSG:4326";

export type CoordSystem = "wgs84" | "sk42";

/**
 * Parses one coordinate written as decimal degrees ("49.6215", "49,6215")
 * or degrees-minutes-seconds ("49°37'12.5\"", "49 37 12.5", "49°37,5'").
 */
export function parseAngle(raw: string): number | null {
  const s = raw.trim().replace(/,/g, ".").replace(/[NnEeСсВв]$/u, "").trim();
  if (!s) return null;
  if (/^-?\d+(\.\d+)?$/.test(s)) return parseFloat(s);
  const parts = s.split(/[°º˚'’′"”″\s]+/u).filter(Boolean).map(Number);
  if (parts.length === 0 || parts.some((p) => isNaN(p))) return null;
  const [d, m = 0, sec = 0] = parts;
  if (m >= 60 || sec >= 60) return null;
  return d + m / 60 + sec / 3600;
}

/**
 * Splits a line into its latitude and longitude parts. Accepts a leading point number
 * ("1.", "1)", "т.1") and separators: tab, semicolon, or the gap between two DMS groups.
 */
function splitLine(line: string): [string, string] | null {
  let s = line.trim();
  if (!s) return null;
  s = s
    .replace(/^т\.?\s*\d+\s*[.):]?\s+/iu, "")
    .replace(/^\d+\s*[.)]\s+/u, "")
    .replace(/^\d+\s*\t/u, "");
  const bySep = s.split(/[\t;|]+/).map((p) => p.trim()).filter(Boolean);
  if (bySep.length >= 2) return [bySep[bySep.length - 2], bySep[bySep.length - 1]];
  // two DMS groups: split after the first seconds/minutes mark
  const dms = s.match(/^(.+?["”″']{1,2}[NnСс]?)\s+(.+)$/u);
  if (dms) return [dms[1], dms[2]];
  // two decimal numbers separated by space(s)
  const nums = s.split(/\s+/);
  if (nums.length === 2) return [nums[0], nums[1]];
  // "lat, lon" with comma separators (decimal points)
  const byComma = s.split(/,\s+/);
  if (byComma.length === 2) return [byComma[0], byComma[1]];
  return null;
}

export type ParseResult = { points: [number, number][]; errors: string[] };

/** Returns points as [longitude, latitude] in WGS-84. Input lines are "широта долгота". */
export function parsePointsText(
  text: string,
  opts: { system: CoordSystem; lonFirst: boolean }
): ParseResult {
  const points: [number, number][] = [];
  const errors: string[] = [];
  text.split(/\r?\n/).forEach((line, i) => {
    if (!line.trim()) return;
    const pair = splitLine(line);
    const a = pair && parseAngle(pair[0]);
    const b = pair && parseAngle(pair[1]);
    if (a == null || b == null) {
      errors.push(`Строка ${i + 1}: не удалось прочитать «${line.trim()}»`);
      return;
    }
    let lat = opts.lonFirst ? b : a;
    let lon = opts.lonFirst ? a : b;
    if (lat < -90 || lat > 90 || lon < -180 || lon > 180) {
      errors.push(`Строка ${i + 1}: координаты вне допустимого диапазона`);
      return;
    }
    if (opts.system === "sk42") [lon, lat] = proj4(SK42, WGS84, [lon, lat]) as [number, number];
    points.push([round(lon), round(lat)]);
  });
  return { points, errors };
}

const round = (n: number) => Math.round(n * 1e7) / 1e7;

/** One corner point written as latitude and longitude (any supported notation) → [lon, lat] in WGS-84. */
export function convertPoint(lat: string, lon: string, system: CoordSystem): [number, number] | null {
  const a = parseAngle(lat);
  const b = parseAngle(lon);
  if (a == null || b == null || a < -90 || a > 90 || b < -180 || b > 180) return null;
  let p: [number, number] = [b, a];
  if (system === "sk42") p = proj4(SK42, WGS84, p) as [number, number];
  return [round(p[0]), round(p[1])];
}

/** Reads "СК-42", "Пулково", "SK-42" as the old system; anything else as WGS-84. */
export function systemFromText(v: string | null | undefined): CoordSystem {
  return /ск|sk|пулков|pulkovo|1942/i.test(v ?? "") ? "sk42" : "wgs84";
}

export function pointsToPolygon(points: [number, number][]): Polygon | null {
  if (points.length < 3) return null;
  const ring = [...points];
  const [f, l] = [ring[0], ring[ring.length - 1]];
  if (f[0] !== l[0] || f[1] !== l[1]) ring.push(f);
  return { type: "Polygon", coordinates: [ring] };
}

export function contourAreaKm2(c: Contour | null): number | null {
  if (!c) return null;
  return area({ type: "Feature", properties: {}, geometry: c } as never) / 1e6;
}

/** Outer ring(s) as [lat, lon] lists, the order Leaflet expects. */
export function toLatLngs(c: Contour): [number, number][][] {
  const polys = c.type === "Polygon" ? [c.coordinates] : c.coordinates;
  return polys.map((p) => p[0].map(([x, y]) => [y, x] as [number, number]));
}

export function contourCorners(c: Contour): [number, number][] {
  const ring = (c.type === "Polygon" ? c.coordinates : c.coordinates[0])[0];
  return ring.slice(0, ring.length > 1 && ring[0][0] === ring[ring.length - 1][0] && ring[0][1] === ring[ring.length - 1][1] ? -1 : undefined) as [number, number][];
}

export function toDMS(v: number, pos: string, neg: string): string {
  const sign = v < 0 ? neg : pos;
  // round once on whole hundredths of a second, so 59.996″ becomes the next minute, never 60.00″
  const total = Math.round(Math.abs(v) * 360000);
  const d = Math.floor(total / 360000);
  const m = Math.floor((total % 360000) / 6000);
  const s = (total % 6000) / 100;
  return `${d}°${String(m).padStart(2, "0")}′${s.toFixed(2).padStart(5, "0")}″ ${sign}`.trim();
}

/** Collects polygons from any GeoJSON (FeatureCollection, Feature or geometry). */
export function extractContour(geo: unknown): Contour | null {
  const polys: number[][][][] = [];
  const visit = (g: any) => {
    if (!g) return;
    if (g.type === "FeatureCollection") g.features.forEach((f: any) => visit(f));
    else if (g.type === "Feature") visit(g.geometry);
    else if (g.type === "GeometryCollection") g.geometries.forEach(visit);
    else if (g.type === "Polygon") polys.push(stripZ(g.coordinates));
    else if (g.type === "MultiPolygon") g.coordinates.forEach((p: any) => polys.push(stripZ(p)));
    else if (g.type === "LineString" && g.coordinates.length >= 3) {
      const ring = stripZ([g.coordinates])[0];
      polys.push([pointsToPolygon(ring as [number, number][])!.coordinates[0]]);
    }
  };
  visit(geo);
  if (polys.length === 0) return null;
  return polys.length === 1
    ? { type: "Polygon", coordinates: polys[0] }
    : { type: "MultiPolygon", coordinates: polys };
}

const stripZ = (rings: number[][][]) => rings.map((r) => r.map(([x, y]) => [round(x), round(y)]));

export function contourToKML(name: string, c: Contour): string {
  const polys = c.type === "Polygon" ? [c.coordinates] : c.coordinates;
  const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");
  const body = polys
    .map(
      (p) =>
        `<Polygon><outerBoundaryIs><LinearRing><coordinates>${p[0]
          .map(([x, y]) => `${x},${y},0`)
          .join(" ")}</coordinates></LinearRing></outerBoundaryIs></Polygon>`
    )
    .join("");
  return `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2"><Document><name>${esc(name)}</name>
<Style id="s"><LineStyle><color>ff1e8ac0</color><width>3</width></LineStyle><PolyStyle><color>401e8ac0</color></PolyStyle></Style>
<Placemark><name>${esc(name)}</name><styleUrl>#s</styleUrl><MultiGeometry>${body}</MultiGeometry></Placemark>
</Document></kml>`;
}
