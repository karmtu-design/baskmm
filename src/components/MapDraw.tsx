"use client";

// Drawing or correcting a site contour right on the map (Terra Draw):
// click the corners to draw a new outline, or drag the corners of the existing one;
// a point in the middle of a side adds a corner, a right click on a corner removes it.
import { useEffect, useRef, useState } from "react";
import type * as maplibregl from "maplibre-gl";
import { TerraDraw, TerraDrawPolygonMode, TerraDrawSelectMode, type GeoJSONStoreFeatures } from "terra-draw";
import { TerraDrawMapLibreGLAdapter } from "terra-draw-maplibre-gl-adapter";
import { tr } from "@/i18n";
import type { Contour } from "@/lib/types";

const STYLE = { fillColor: "#C9A45C" as const, outlineColor: "#E0B860" as const, fillOpacity: 0.2, outlineWidth: 3 };

export default function MapDraw({ map, ready, initial, onChange }: { map: maplibregl.Map | null; ready: boolean; initial: Contour | null; onChange: (c: Contour | null) => void }) {
  const draw = useRef<TerraDraw | null>(null);
  const [mode, setMode] = useState<"polygon" | "select">(initial ? "select" : "polygon");
  const cb = useRef(onChange);
  cb.current = onChange;

  useEffect(() => {
    if (!map || !ready) return;
    const d = new TerraDraw({
      adapter: new TerraDrawMapLibreGLAdapter({ map, coordinatePrecision: 7 }),
      modes: [
        new TerraDrawPolygonMode({ styles: STYLE }),
        new TerraDrawSelectMode({
          flags: { polygon: { feature: { draggable: true, coordinates: { midpoints: true, draggable: true, deletable: true } } } },
          styles: { selectedPolygonColor: "#C9A45C", selectedPolygonOutlineColor: "#E0B860", selectedPolygonFillOpacity: 0.2, selectionPointColor: "#ffffff", midPointColor: "#E0B860" },
        }),
      ],
    });
    d.start();
    const emit = () => {
      const polys = d.getSnapshot().filter((f) => f.geometry.type === "Polygon");
      const last = polys[polys.length - 1];
      cb.current(last ? (last.geometry as Contour) : null);
    };
    if (initial) {
      const geoms = initial.type === "Polygon" ? [initial.coordinates] : initial.coordinates;
      const r7 = (v: number) => Math.round(v * 1e7) / 1e7;
      const res = d.addFeatures(
        geoms.map(
          (rings) =>
            ({
              type: "Feature",
              properties: { mode: "polygon" },
              // the drawing tool accepts up to 7 decimals (about 1 cm) and one outer ring
              geometry: { type: "Polygon", coordinates: [rings[0].map(([x, y]) => [r7(x), r7(y)])] },
            }) as GeoJSONStoreFeatures
        )
      );
      res.filter((r) => !r.valid).forEach((r) => console.warn("contour not editable:", r.reason));
    }
    d.on("finish", () => {
      // one contour at a time: a newly drawn outline replaces the previous one
      const snap = d.getSnapshot().filter((f) => f.geometry.type === "Polygon");
      if (snap.length > 1) d.removeFeatures(snap.slice(0, -1).map((f) => f.id!));
      emit();
    });
    d.on("change", (_ids, type) => {
      if (type === "update" || type === "delete") emit();
    });
    d.setMode(initial ? "select" : "polygon");
    if (initial) {
      const first = d.getSnapshot()[0];
      if (first?.id != null) d.selectFeature(first.id);
    }
    draw.current = d;
    return () => {
      try {
        d.stop();
      } catch {
        /* the map is already gone */
      }
      draw.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, ready]);

  function switchTo(m: "polygon" | "select") {
    setMode(m);
    draw.current?.setMode(m);
  }
  function clear() {
    draw.current?.clear();
    cb.current(null);
    switchTo("polygon");
  }

  return (
    <div className="map-draw-bar" role="toolbar" aria-label={tr("Рисование контура")}>
      <button type="button" className={`map-tool-btn${mode === "polygon" ? " is-active" : ""}`} onClick={() => switchTo("polygon")}>
        ✏️ {tr("Рисовать новый")}
      </button>
      <button type="button" className={`map-tool-btn${mode === "select" ? " is-active" : ""}`} onClick={() => switchTo("select")}>
        ✋ {tr("Править углы")}
      </button>
      <button type="button" className="map-tool-btn" onClick={clear}>
        🗑 {tr("Стереть")}
      </button>
      <span className="map-draw-hint">
        {mode === "polygon"
          ? tr("Нажимайте на углы участка по порядку; чтобы закончить, нажмите на первую точку")
          : tr("Тяните угол мышкой; точка в середине стороны добавляет угол, правый щелчок по углу удаляет его")}
      </span>
    </div>
  );
}
