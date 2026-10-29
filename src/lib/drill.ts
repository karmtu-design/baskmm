// Drill-hole geometry and grade statistics.
import type { Contour, Drillhole, DrillInterval } from "./types";

export type XYZ = [number, number, number];

/** Local metric frame around a reference point: x to the east, y to the north, z = height in metres. */
export function makeFrame(lon0: number, lat0: number) {
  const kx = 111320 * Math.cos((lat0 * Math.PI) / 180);
  const ky = 110540;
  return {
    toXY: (lon: number, lat: number): [number, number] => [(lon - lon0) * kx, (lat - lat0) * ky],
  };
}

/** Straight-line desurvey: one azimuth and dip for the whole hole (enough for most historical data). */
export function pointAtDepth(collar: XYZ, azimuthDeg: number, dipDeg: number, depth: number): XYZ {
  const az = (azimuthDeg * Math.PI) / 180;
  const dip = (dipDeg * Math.PI) / 180; // negative = downwards
  const h = Math.cos(dip) * depth;
  return [collar[0] + Math.sin(az) * h, collar[1] + Math.cos(az) * h, collar[2] + Math.sin(dip) * depth];
}

export function elementsOf(holes: Drillhole[]): string[] {
  return [...new Set(holes.flatMap((h) => h.drill_intervals.map((i) => i.element).filter((e): e is string => !!e)))].sort();
}

/** Class breaks at the 50th, 75th, 90th and 97th percentile of the grades, for a readable colour scale. */
export function gradeBreaks(holes: Drillhole[], element: string): number[] {
  const g = holes
    .flatMap((h) => h.drill_intervals)
    .filter((i) => i.element === element && i.grade != null)
    .map((i) => i.grade!)
    .sort((a, b) => a - b);
  if (!g.length) return [0, 0, 0, 0];
  const q = (p: number) => g[Math.min(g.length - 1, Math.floor(p * g.length))];
  return [q(0.5), q(0.75), q(0.9), q(0.97)];
}

export const GRADE_COLORS: [number, number, number][] = [
  [110, 126, 145], // low
  [70, 150, 200],
  [90, 190, 120],
  [235, 200, 70],
  [235, 110, 60], // highest
];

export function gradeColor(grade: number | null, breaks: number[]): [number, number, number, number] {
  if (grade == null) return [90, 100, 110, 140];
  let k = 0;
  while (k < breaks.length && grade > breaks[k]) k++;
  return [...GRADE_COLORS[k], 255];
}

/** Best continuous intercept above the cut-off: length-weighted mean grade, e.g. «36 м @ 0,62 % с 128 м». */
export function bestIntercept(intervals: DrillInterval[], element: string, cutoff: number) {
  const rows = intervals.filter((i) => i.element === element && i.grade != null).sort((a, b) => a.from_m - b.from_m);
  let best: { from: number; to: number; grade: number; metal: number } | null = null;
  let cur: { from: number; to: number; metal: number } | null = null;
  const close = () => {
    if (cur) {
      const len = cur.to - cur.from;
      const g = cur.metal / len;
      if (!best || len * g > best.metal) best = { from: cur.from, to: cur.to, grade: g, metal: len * g };
    }
    cur = null;
  };
  for (const r of rows) {
    if (r.grade! >= cutoff) {
      if (cur && Math.abs(r.from_m - cur.to) < 0.01) {
        cur.to = r.to_m;
        cur.metal += r.grade! * (r.to_m - r.from_m);
      } else {
        close();
        cur = { from: r.from_m, to: r.to_m, metal: r.grade! * (r.to_m - r.from_m) };
      }
    } else close();
  }
  close();
  return best as { from: number; to: number; grade: number; metal: number } | null;
}

export function contourRing(c: Contour | null): number[][] | null {
  if (!c) return null;
  return c.type === "Polygon" ? c.coordinates[0] : c.coordinates[0][0];
}
