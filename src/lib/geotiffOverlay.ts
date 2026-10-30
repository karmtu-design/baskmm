// Turning a GeoTIFF (a geological map or a satellite scene with coordinates) into a picture laid on the map.
// Read in the browser: the image is scaled down to at most 2048 px, saved as WebP, and placed by its four corners.
"use client";

import proj4 from "proj4";
import { crsLabel, type Crs } from "./geoImport";

const MAX_SIDE = 2048;
const SK42 = "+ellps=krass +towgs84=23.57,-140.95,-79.8,0,0.35,0.79,-0.22";

export type Corners = [[number, number], [number, number], [number, number], [number, number]];
export type OverlayImage = { blob: Blob; corners: Corners; crsName: string; width: number; height: number };

/** EPSG codes seen on Kazakh maps → a proj4 definition. */
function fromEpsg(code: number): { def: string | null; name: string } | null {
  if (code === 4326) return { def: null, name: "WGS-84 (EPSG:4326)" };
  if (code === 4284) return { def: `+proj=longlat ${SK42} +no_defs`, name: "СК-42, градусы (EPSG:4284)" };
  if (code === 3857 || code === 900913) return { def: "EPSG:3857", name: "Web Mercator (EPSG:3857)" };
  if (code >= 32601 && code <= 32660) return { def: `+proj=utm +zone=${code - 32600} +datum=WGS84 +units=m +no_defs`, name: `WGS-84 / UTM ${code - 32600}N` };
  if (code >= 28404 && code <= 28432) {
    const z = code - 28400;
    return { def: `+proj=tmerc +lat_0=0 +lon_0=${z * 6 - 3} +k=1 +x_0=${z * 1e6 + 5e5} +y_0=0 ${SK42} +units=m +no_defs`, name: `СК-42 / Гаусс–Крюгер, зона ${z}` };
  }
  return null;
}

function fromChoice(c: Crs): { def: string | null; name: string } {
  if (c.kind === "wgs84") return { def: null, name: crsLabel(c) };
  if (c.kind === "utm") return { def: `+proj=utm +zone=${c.zone} +datum=WGS84 +units=m +no_defs`, name: crsLabel(c) };
  const x0 = (c.prefix ? c.zone * 1e6 : 0) + 5e5;
  return { def: `+proj=tmerc +lat_0=0 +lon_0=${c.zone * 6 - 3} +k=1 +x_0=${x0} +y_0=0 ${SK42} +units=m +no_defs`, name: crsLabel(c) };
}

/** Reads the file; when its coordinate system is not recognised, says so and asks for `manual`. */
export async function readGeoTiff(file: File, manual?: Crs): Promise<OverlayImage | { needCrs: true; epsg: number | null }> {
  const { fromArrayBuffer } = await import("geotiff");
  const tiff = await fromArrayBuffer(await file.arrayBuffer());
  const image = await tiff.getImage();
  const keys = image.getGeoKeys() ?? {};
  const epsg = Number(keys.ProjectedCSTypeGeoKey ?? keys.GeographicTypeGeoKey ?? 0) || null;
  const sys = manual ? fromChoice(manual) : epsg ? fromEpsg(epsg) : null;
  if (!sys) return { needCrs: true, epsg };

  let bbox: number[];
  try {
    bbox = image.getBoundingBox();
  } catch {
    throw new Error("в файле нет привязки к координатам (это обычная картинка TIFF, а не GeoTIFF)");
  }
  const [minX, minY, maxX, maxY] = bbox;
  const to = (x: number, y: number): [number, number] => {
    const [lon, lat] = sys.def ? proj4(sys.def, "EPSG:4326", [x, y]) : [x, y];
    return [Math.round(lon * 1e7) / 1e7, Math.round(lat * 1e7) / 1e7];
  };
  const corners: Corners = [to(minX, maxY), to(maxX, maxY), to(maxX, minY), to(minX, minY)];
  if (corners.some(([lon, lat]) => !isFinite(lon) || !isFinite(lat) || Math.abs(lat) > 85 || Math.abs(lon) > 180))
    throw new Error("координаты углов не получились: проверьте систему координат");

  const w0 = image.getWidth(),
    h0 = image.getHeight();
  const k = Math.min(1, MAX_SIDE / Math.max(w0, h0));
  const width = Math.max(1, Math.round(w0 * k)),
    height = Math.max(1, Math.round(h0 * k));
  const rgba = new Uint8ClampedArray(width * height * 4);
  const nodata = image.getGDALNoData();
  try {
    const rgb = (await image.readRGB({ width, height, interleave: true, enableAlpha: true })) as unknown as ArrayLike<number> & { length: number };
    const stride = rgb.length / (width * height);
    for (let i = 0, j = 0; i < width * height; i++, j += stride) {
      const r = rgb[j],
        g = rgb[j + 1],
        b = rgb[j + 2];
      rgba[i * 4] = r;
      rgba[i * 4 + 1] = g;
      rgba[i * 4 + 2] = b;
      rgba[i * 4 + 3] = stride >= 4 ? rgb[j + 3] : nodata != null && r === nodata && g === nodata && b === nodata ? 0 : 255;
    }
  } catch {
    // one band of numbers (e.g. a relief or a geochemical grid): shades of grey from min to max
    const [band] = (await image.readRasters({ width, height, samples: [0] })) as unknown as ArrayLike<number>[];
    let lo = Infinity,
      hi = -Infinity;
    for (let i = 0; i < band.length; i++) {
      const v = band[i];
      if (v === nodata || !isFinite(v)) continue;
      if (v < lo) lo = v;
      if (v > hi) hi = v;
    }
    const span = hi - lo || 1;
    for (let i = 0; i < band.length; i++) {
      const v = band[i];
      const g = Math.round(((v - lo) / span) * 255);
      rgba.set([g, g, g, v === nodata || !isFinite(v) ? 0 : 255], i * 4);
    }
  }
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  canvas.getContext("2d")!.putImageData(new ImageData(rgba, width, height), 0, 0);
  const blob = await new Promise<Blob>((res, rej) =>
    canvas.toBlob((b) => (b ? res(b) : rej(new Error("картинка не сохранилась"))), "image/webp", 0.85)
  );
  return { blob, corners, crsName: sys.name, width, height };
}
