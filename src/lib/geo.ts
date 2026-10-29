// Geo-analysis of licence areas with Turf.js: overlaps, buffer zones, distances,
// and nearby settlements, roads and railways from OpenStreetMap (Overpass API).
import {
  area as turfArea,
  buffer as turfBuffer,
  centroid,
  feature,
  featureCollection,
  intersect,
  point,
  pointToLineDistance,
  pointToPolygonDistance,
} from "@turf/turf";
import type { Contour } from "./types";

type Lic = { id: number; deposit_name: string | null; license_number: string; company_name: string; contour: Contour | null };

const f = (c: Contour) => feature(c);
export const km2 = (c: Contour) => turfArea(f(c)) / 1e6;

export type Overlap = { a: Lic; b: Lic; areaKm2: number; shareA: number; shareB: number; shape: Contour };

/** Every pair of licences whose areas overlap, with the shared area. */
export function findOverlaps(licenses: Lic[], only?: number): Overlap[] {
  const withShape = licenses.filter((l) => l.contour);
  const out: Overlap[] = [];
  for (let i = 0; i < withShape.length; i++)
    for (let j = i + 1; j < withShape.length; j++) {
      const a = withShape[i],
        b = withShape[j];
      if (only != null && a.id !== only && b.id !== only) continue;
      try {
        const x = intersect(featureCollection([f(a.contour!), f(b.contour!)]));
        if (!x) continue;
        const s = turfArea(x) / 1e6;
        if (s < 0.0001) continue; // touching edges only
        out.push({
          a,
          b,
          areaKm2: s,
          shareA: s / km2(a.contour!),
          shareB: s / km2(b.contour!),
          shape: x.geometry as Contour,
        });
      } catch {
        // an invalid shape (self-crossing contour) is skipped rather than breaking the page
      }
    }
  return out.sort((p, q) => q.areaKm2 - p.areaKm2);
}

/** Zone of the given width around a contour, e.g. a sanitary or safety zone. */
export function bufferZone(c: Contour, kmWidth: number): Contour | null {
  const b = turfBuffer(f(c), kmWidth, { units: "kilometers" });
  return (b?.geometry as Contour) ?? null;
}

function ringsOf(c: Contour): number[][][] {
  return c.type === "Polygon" ? [c.coordinates[0]] : c.coordinates.map((p) => p[0]);
}

/** Shortest distance between two areas in km (0 when they overlap or touch). */
export function areaDistanceKm(a: Contour, b: Contour): number {
  let best = Infinity;
  const fb = f(b) as never;
  const fa = f(a) as never;
  for (const r of ringsOf(a)) for (const p of r) best = Math.min(best, Math.max(0, pointToPolygonDistance(point(p), fb, { units: "kilometers" })));
  for (const r of ringsOf(b)) for (const p of r) best = Math.min(best, Math.max(0, pointToPolygonDistance(point(p), fa, { units: "kilometers" })));
  return best;
}

/** For each licence, the nearest other licence of the group. */
export function nearestNeighbours(licenses: Lic[]) {
  const withShape = licenses.filter((l) => l.contour);
  return withShape
    .map((l) => {
      let best: { other: Lic; km: number } | null = null;
      for (const o of withShape) {
        if (o.id === l.id) continue;
        const d = areaDistanceKm(l.contour!, o.contour!);
        if (!best || d < best.km) best = { other: o, km: d };
      }
      return { license: l, nearest: best };
    })
    .filter((x) => x.nearest)
    .sort((p, q) => p.nearest!.km - q.nearest!.km);
}

// ---------- nearby infrastructure from OpenStreetMap ----------

export type Nearby = {
  places: { name: string; kind: string; lon: number; lat: number; km: number; population?: string }[];
  roads: { name: string; kind: string; km: number; coordinates: [number, number][] }[];
  rail: { name: string; km: number; coordinates: [number, number][] } | null;
  power: { name: string; km: number; coordinates: [number, number][] } | null;
};

const PLACE_KIND: Record<string, string> = { city: "город", town: "город", village: "село", hamlet: "посёлок" };
const ROAD_KIND: Record<string, string> = {
  motorway: "автомагистраль",
  trunk: "трасса республиканского значения",
  primary: "основная дорога",
  secondary: "дорога областного значения",
  tertiary: "местная дорога",
};

/** Settlements, main roads, railway and power lines within radiusKm of the area, nearest first. */
export async function findNearby(c: Contour, radiusKm = 40): Promise<Nearby> {
  const [lon, lat] = centroid(f(c)).geometry.coordinates;
  const r = Math.round(radiusKm * 1000);
  const q = `[out:json][timeout:25];
(
  node["place"~"^(city|town|village|hamlet)$"](around:${r},${lat},${lon});
  way["highway"~"^(motorway|trunk|primary|secondary|tertiary)$"](around:${r},${lat},${lon});
  way["railway"="rail"](around:${r},${lat},${lon});
  way["power"="line"](around:${r},${lat},${lon});
);
out geom;`;
  const res = await fetch("https://overpass-api.de/api/interpreter", {
    method: "POST",
    body: new URLSearchParams({ data: q }),
  });
  if (!res.ok) throw new Error(res.status === 429 ? "сервис занят, попробуйте через минуту" : `ошибка ${res.status}`);
  const data = (await res.json()) as { elements: any[] };
  const poly = f(c) as never;
  const verts = ringsOf(c).flat();
  const lineKm = (coords: [number, number][]) => {
    let best = Infinity;
    const line = feature({ type: "LineString", coordinates: coords }) as never;
    for (const v of verts) best = Math.min(best, pointToLineDistance(point(v), line, { units: "kilometers" }));
    for (const p of coords) best = Math.min(best, Math.max(0, pointToPolygonDistance(point(p), poly, { units: "kilometers" })));
    return best;
  };

  const places: Nearby["places"] = [];
  const roads = new Map<string, Nearby["roads"][number]>();
  let rail: Nearby["rail"] = null;
  let power: Nearby["power"] = null;
  for (const el of data.elements ?? []) {
    const t = el.tags ?? {};
    if (el.type === "node" && t.place) {
      const km = Math.max(0, pointToPolygonDistance(point([el.lon, el.lat]), poly, { units: "kilometers" }));
      places.push({ name: t["name:ru"] || t.name || "без названия", kind: PLACE_KIND[t.place] ?? t.place, lon: el.lon, lat: el.lat, km, population: t.population });
    } else if (el.type === "way" && el.geometry?.length > 1) {
      const coords = el.geometry.map((g: { lon: number; lat: number }) => [g.lon, g.lat]) as [number, number][];
      const km = lineKm(coords);
      if (t.highway) {
        const name = t.ref ? `${t.ref}${t.name ? ` ${t.name}` : ""}` : t["name:ru"] || t.name || ROAD_KIND[t.highway];
        const key = `${t.highway}|${name}`;
        const prev = roads.get(key);
        if (!prev || km < prev.km) roads.set(key, { name, kind: ROAD_KIND[t.highway] ?? t.highway, km, coordinates: coords });
      } else if (t.railway === "rail") {
        if (!rail || km < rail.km) rail = { name: t["name:ru"] || t.name || "железная дорога", km, coordinates: coords };
      } else if (t.power === "line") {
        const name = t.voltage ? `ЛЭП ${Math.round(Number(String(t.voltage).split(";")[0]) / 1000)} кВ` : "ЛЭП";
        if (!power || km < power.km) power = { name, km, coordinates: coords };
      }
    }
  }
  return {
    places: places.sort((a, b) => a.km - b.km).slice(0, 8),
    roads: [...roads.values()].sort((a, b) => a.km - b.km).slice(0, 6),
    rail,
    power,
  };
}
