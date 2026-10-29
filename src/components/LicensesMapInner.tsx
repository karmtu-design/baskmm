"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import * as maplibregl from "maplibre-gl";
import type { GeoJSONSource, LngLatBoundsLike, MapLayerMouseEvent, StyleSpecification } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { centroid } from "@turf/turf";
import type { Contour } from "@/lib/types";
import { mineralColor } from "@/lib/types";

export type MapLicense = {
  id: number;
  deposit_name: string | null;
  license_number: string;
  mineral: string | null;
  company_name: string;
  license_type: string | null;
  status: string | null;
  contour: Contour | null;
};

/** Extra things drawn on top of the licences: a buffer zone, places and roads found nearby. */
export type MapOverlay = {
  buffer?: Contour | null;
  /** areas to flag in red, e.g. where two licences overlap */
  highlight?: Contour[];
  points?: { name: string; lon: number; lat: number; kind: string }[];
  lines?: { name: string; coordinates: [number, number][]; kind: string }[];
};

type Basemap = "scheme" | "satellite" | "topo";

const KZ_BOUNDS: LngLatBoundsLike = [
  [46.5, 40.5],
  [87.5, 55.5],
];

let workerSet = false;

/** Raster basemaps plus a free elevation model (terrain tiles from the AWS open data registry). */
function baseStyle(): StyleSpecification {
  return {
    version: 8,
    sources: {
      scheme: {
        type: "raster",
        tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
        tileSize: 256,
        maxzoom: 19,
        attribution: "© участники OpenStreetMap",
      },
      satellite: {
        type: "raster",
        tiles: ["https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"],
        tileSize: 256,
        maxzoom: 19,
        attribution: "Снимки © Esri, Maxar, Earthstar Geographics",
      },
      topo: {
        type: "raster",
        tiles: ["https://a.tile.opentopomap.org/{z}/{x}/{y}.png", "https://b.tile.opentopomap.org/{z}/{x}/{y}.png"],
        tileSize: 256,
        maxzoom: 17,
        attribution: "© OpenTopoMap (CC-BY-SA)",
      },
      dem: {
        type: "raster-dem",
        tiles: ["https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png"],
        tileSize: 256,
        maxzoom: 14,
        encoding: "terrarium",
        attribution: "Рельеф: Terrain Tiles (AWS Open Data)",
      },
    },
    layers: [
      { id: "scheme", type: "raster", source: "scheme", layout: { visibility: "visible" } },
      { id: "satellite", type: "raster", source: "satellite", layout: { visibility: "none" } },
      { id: "topo", type: "raster", source: "topo", layout: { visibility: "none" } },
      { id: "hillshade", type: "hillshade", source: "dem", layout: { visibility: "none" }, paint: { "hillshade-exaggeration": 0.35 } },
    ],
  };
}

function rings(c: Contour): number[][][] {
  return c.type === "Polygon" ? [c.coordinates[0]] : c.coordinates.map((p) => p[0]);
}

function boundsOf(contours: Contour[]): LngLatBoundsLike | null {
  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity;
  contours.forEach((c) =>
    rings(c).forEach((r) =>
      r.forEach(([x, y]) => {
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
      })
    )
  );
  return isFinite(minX) ? [[minX, minY], [maxX, maxY]] : null;
}

function licensesGeoJSON(licenses: MapLicense[]) {
  return {
    type: "FeatureCollection" as const,
    features: licenses
      .filter((l) => l.contour)
      .map((l) => ({
        type: "Feature" as const,
        id: l.id,
        properties: { id: l.id, color: mineralColor(l.mineral) },
        geometry: l.contour!,
      })),
  };
}

const empty = { type: "FeatureCollection" as const, features: [] };

export default function LicensesMapInner({
  licenses,
  height = 520,
  showLabels = true,
  preview,
  linkToLicense = true,
  overlay,
  initial3d = false,
}: {
  licenses: MapLicense[];
  height?: number;
  showLabels?: boolean;
  preview?: Contour | null;
  linkToLicense?: boolean;
  overlay?: MapOverlay;
  initial3d?: boolean;
}) {
  const router = useRouter();
  const box = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const markers = useRef<maplibregl.Marker[]>([]);
  const [ready, setReady] = useState(false);
  const [basemap, setBasemap] = useState<Basemap>("scheme");
  const [is3d, setIs3d] = useState(initial3d);
  const licRef = useRef(licenses);
  licRef.current = licenses;

  // create the map once
  useEffect(() => {
    if (!box.current) return;
    if (!workerSet) {
      maplibregl.setWorkerUrl("/vendor/maplibre-gl-worker.mjs");
      workerSet = true;
    }
    const m = new maplibregl.Map({
      container: box.current,
      style: baseStyle(),
      bounds: KZ_BOUNDS,
      maxPitch: 80,
      attributionControl: { compact: true },
    });
    m.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), "top-left");
    m.addControl(new maplibregl.ScaleControl({ unit: "metric" }), "bottom-left");
    m.on("load", () => {
      m.addSource("licenses", { type: "geojson", data: empty });
      m.addLayer({ id: "lic-fill", type: "fill", source: "licenses", paint: { "fill-color": ["get", "color"], "fill-opacity": 0.3 } });
      m.addLayer({ id: "lic-line", type: "line", source: "licenses", paint: { "line-color": ["get", "color"], "line-width": 2.5 } });
      m.addSource("preview", { type: "geojson", data: empty });
      m.addLayer({ id: "preview-fill", type: "fill", source: "preview", paint: { "fill-color": "#C9A45C", "fill-opacity": 0.15 } });
      m.addLayer({ id: "preview-line", type: "line", source: "preview", paint: { "line-color": "#C9A45C", "line-width": 3, "line-dasharray": [2, 1.5] } });
      m.addSource("buffer", { type: "geojson", data: empty });
      m.addLayer({ id: "buffer-line", type: "line", source: "buffer", paint: { "line-color": "#E0B860", "line-width": 1.5, "line-dasharray": [1, 1.5] } });
      m.addSource("highlight", { type: "geojson", data: empty });
      m.addLayer({ id: "highlight-fill", type: "fill", source: "highlight", paint: { "fill-color": "#E5484D", "fill-opacity": 0.5 } });
      m.addLayer({ id: "highlight-line", type: "line", source: "highlight", paint: { "line-color": "#E5484D", "line-width": 2 } });
      m.addSource("osm-lines", { type: "geojson", data: empty });
      m.addLayer({ id: "osm-lines", type: "line", source: "osm-lines", paint: { "line-color": "#E06C4C", "line-width": 2 } });
      m.on("mouseenter", "lic-fill", () => (m.getCanvas().style.cursor = "pointer"));
      m.on("mouseleave", "lic-fill", () => (m.getCanvas().style.cursor = ""));
      m.on("click", "lic-fill", (e: MapLayerMouseEvent) => {
        const id = e.features?.[0]?.properties?.id as number | undefined;
        const l = licRef.current.find((x) => x.id === id);
        if (!l) return;
        // built from text nodes only, so names from the database can never inject markup
        const el = document.createElement("div");
        el.className = "map-popup";
        const add = (tag: string, text: string, cls?: string) => {
          const n = document.createElement(tag);
          n.textContent = text;
          if (cls) n.className = cls;
          el.appendChild(n);
          return n;
        };
        add("strong", l.deposit_name || "Участок");
        add("div", l.license_number, "muted");
        add("div", [l.mineral, l.license_type].filter(Boolean).join(", "));
        add("div", l.company_name);
        if (linkToLicense) {
          const a = add("a", "Открыть лицензию") as HTMLAnchorElement;
          a.href = `/licenses/${l.id}`;
          a.onclick = (ev) => {
            ev.preventDefault();
            router.push(`/licenses/${l.id}`);
          };
        }
        new maplibregl.Popup({ maxWidth: "260px" }).setLngLat(e.lngLat).setDOMContent(el).addTo(m);
      });
      setReady(true);
    });
    map.current = m;
    return () => {
      markers.current.forEach((mk) => mk.remove());
      m.remove();
      map.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // licences, labels and fit
  useEffect(() => {
    const m = map.current;
    if (!m || !ready) return;
    (m.getSource("licenses") as GeoJSONSource).setData(licensesGeoJSON(licenses));
    (m.getSource("preview") as GeoJSONSource).setData(
      preview ? { type: "FeatureCollection", features: [{ type: "Feature", properties: {}, geometry: preview }] } : empty
    );
    markers.current.forEach((mk) => mk.remove());
    markers.current = [];
    if (showLabels) {
      licenses.forEach((l) => {
        if (!l.contour) return;
        const [x, y] = centroid({ type: "Feature", properties: {}, geometry: l.contour }).geometry.coordinates;
        const el = document.createElement("div");
        el.className = "map-label";
        el.textContent = l.deposit_name || l.license_number;
        markers.current.push(new maplibregl.Marker({ element: el, anchor: "left", offset: [10, 0] }).setLngLat([x, y]).addTo(m));
      });
    }
    const b = boundsOf([...licenses.map((l) => l.contour).filter((c): c is Contour => !!c), ...(preview ? [preview] : [])]);
    m.fitBounds(b ?? KZ_BOUNDS, { padding: 48, maxZoom: 13, duration: 600, pitch: is3d ? 55 : 0 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, licenses, preview, showLabels]);

  // overlays from the geo-analysis panel
  useEffect(() => {
    const m = map.current;
    if (!m || !ready) return;
    (m.getSource("buffer") as GeoJSONSource).setData(
      overlay?.buffer ? { type: "FeatureCollection", features: [{ type: "Feature", properties: {}, geometry: overlay.buffer }] } : empty
    );
    (m.getSource("highlight") as GeoJSONSource).setData({
      type: "FeatureCollection",
      features: (overlay?.highlight ?? []).map((g) => ({ type: "Feature", properties: {}, geometry: g })),
    });
    (m.getSource("osm-lines") as GeoJSONSource).setData({
      type: "FeatureCollection",
      features: (overlay?.lines ?? []).map((l) => ({
        type: "Feature",
        properties: { name: l.name },
        geometry: { type: "LineString", coordinates: l.coordinates },
      })),
    });
    const pts = (overlay?.points ?? []).map((p) => {
      const el = document.createElement("div");
      el.className = "map-place";
      el.textContent = p.name;
      el.title = p.kind;
      return new maplibregl.Marker({ element: el, anchor: "bottom" }).setLngLat([p.lon, p.lat]).addTo(m);
    });
    return () => pts.forEach((p) => p.remove());
  }, [ready, overlay]);

  // basemap
  useEffect(() => {
    const m = map.current;
    if (!m || !ready) return;
    (["scheme", "satellite", "topo"] as Basemap[]).forEach((id) =>
      m.setLayoutProperty(id, "visibility", id === basemap ? "visible" : "none")
    );
  }, [ready, basemap]);

  // 3D relief: runs only when the switch changes, so it never cancels the first fit to the licences
  const was3d = useRef(false);
  useEffect(() => {
    const m = map.current;
    if (!m || !ready || was3d.current === is3d) return;
    was3d.current = is3d;
    if (is3d) {
      m.setTerrain({ source: "dem", exaggeration: 1.6 });
      m.setLayoutProperty("hillshade", "visibility", "visible");
      m.easeTo({ pitch: 60, bearing: m.getBearing() || -15, duration: 900 });
    } else {
      m.setTerrain(null);
      m.setLayoutProperty("hillshade", "visibility", "none");
      m.easeTo({ pitch: 0, bearing: 0, duration: 600 });
    }
  }, [ready, is3d]);

  const btn = (active: boolean) => `map-switch-btn${active ? " is-active" : ""}`;
  return (
    <div className="map-shell" style={{ height }}>
      <div ref={box} style={{ position: "absolute", inset: 0 }} />
      <div className="map-switch" role="group" aria-label="Подложка карты">
        <button type="button" className={btn(basemap === "scheme")} onClick={() => setBasemap("scheme")}>
          Схема
        </button>
        <button type="button" className={btn(basemap === "satellite")} onClick={() => setBasemap("satellite")}>
          Спутник
        </button>
        <button type="button" className={btn(basemap === "topo")} onClick={() => setBasemap("topo")}>
          Топо
        </button>
        <span className="map-switch-sep" />
        <button
          type="button"
          className={btn(is3d)}
          onClick={() => setIs3d((v) => !v)}
          aria-pressed={is3d}
          title="Объёмный рельеф: наклоните карту правой кнопкой мыши или двумя пальцами"
        >
          3D-рельеф
        </button>
      </div>
    </div>
  );
}
