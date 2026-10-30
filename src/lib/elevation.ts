"use client";

// Heights along a line, read from the same free terrain tiles the 3D relief uses
// (AWS Terrain Tiles, "terrarium" encoding: height = R·256 + G + B/256 − 32768 metres).
import { along, length, lineString } from "@turf/turf";

const URL = (z: number, x: number, y: number) => `https://s3.amazonaws.com/elevation-tiles-prod/terrarium/${z}/${x}/${y}.png`;
const cache = new Map<string, Promise<ImageData | null>>();

function tile(z: number, x: number, y: number): Promise<ImageData | null> {
  const k = `${z}/${x}/${y}`;
  if (!cache.has(k))
    cache.set(
      k,
      new Promise((resolve) => {
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.onload = () => {
          const c = document.createElement("canvas");
          c.width = c.height = 256;
          const g = c.getContext("2d", { willReadFrequently: true })!;
          g.drawImage(img, 0, 0);
          resolve(g.getImageData(0, 0, 256, 256));
        };
        img.onerror = () => resolve(null);
        img.src = URL(z, x, y);
      })
    );
  return cache.get(k)!;
}

async function heightAt(lng: number, lat: number, z: number): Promise<number | null> {
  const n = 2 ** z;
  const fx = ((lng + 180) / 360) * n;
  const r = (lat * Math.PI) / 180;
  const fy = ((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * n;
  const tx = Math.floor(fx),
    ty = Math.floor(fy);
  const d = await tile(z, tx, ty);
  if (!d) return null;
  const px = Math.min(255, Math.floor((fx - tx) * 256)),
    py = Math.min(255, Math.floor((fy - ty) * 256));
  const i = (py * 256 + px) * 4;
  return Math.round(d.data[i] * 256 + d.data[i + 1] + d.data[i + 2] / 256 - 32768);
}

export type ProfilePoint = { km: number; h: number | null; lng: number; lat: number };

/** Evenly spaced samples along the line (up to 200), with the distance from the start in km. */
export async function elevationProfile(points: [number, number][], samples = 200): Promise<ProfilePoint[]> {
  const line = lineString(points);
  const total = length(line, { units: "kilometers" });
  // finer tiles for short lines: about 10 m per pixel at z14, 150 m at z10
  const z = total < 8 ? 14 : total < 30 ? 13 : total < 120 ? 12 : total < 400 ? 11 : 10;
  const n = Math.max(2, Math.min(samples, Math.ceil(total * 20)));
  const pts = Array.from({ length: n }, (_, i) => {
    const km = (total * i) / (n - 1);
    const [lng, lat] = along(line, km, { units: "kilometers" }).geometry.coordinates;
    return { km, lng, lat };
  });
  const hs = await Promise.all(pts.map((p) => heightAt(p.lng, p.lat, z)));
  return pts.map((p, i) => ({ ...p, h: hs[i] }));
}
