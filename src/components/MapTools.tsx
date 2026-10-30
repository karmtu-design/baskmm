"use client";

// Tools on top of any map: ruler, area, terrain profile, save as PNG/PDF, and a «before/after» swipe
// that shows a second basemap on the right side of a draggable line.
import { useEffect, useRef, useState } from "react";
import * as maplibregl from "maplibre-gl";
import type { GeoJSONSource, MapMouseEvent, StyleSpecification } from "maplibre-gl";
import { area as turfArea, length as turfLength, lineString, polygon } from "@turf/turf";
import { tr, loc } from "@/i18n";
import ElevationChart from "./ElevationChart";
import type { ProfilePoint } from "@/lib/elevation";

type Tool = "none" | "measure" | "area" | "profile";
type Basemap = "scheme" | "satellite" | "topo";
const empty = { type: "FeatureCollection" as const, features: [] };
const nf = (v: number, d = 2) => v.toLocaleString(loc(), { maximumFractionDigits: d });
const km = (v: number) => (v < 1 ? `${nf(v * 1000, 0)} ${tr("м")}` : `${nf(v, v < 10 ? 2 : 1)} ${tr("км")}`);

export default function MapTools({
  map,
  ready,
  shell,
  baseStyle,
  basemap,
  title,
  contours,
}: {
  map: maplibregl.Map | null;
  ready: boolean;
  shell: HTMLDivElement | null;
  baseStyle: () => StyleSpecification;
  basemap: Basemap;
  title: string;
  contours: GeoJSON.FeatureCollection;
}) {
  const [tool, setTool] = useState<Tool>("none");
  const [pts, setPts] = useState<[number, number][]>([]);
  const [profile, setProfile] = useState<ProfilePoint[] | null>(null);
  const [busy, setBusy] = useState("");
  const [compare, setCompare] = useState(false);
  const toolRef = useRef<Tool>("none");
  toolRef.current = tool;
  const ptsRef = useRef(pts);
  ptsRef.current = pts;

  // layers for the drawing
  useEffect(() => {
    const m = map;
    if (!m || !ready || m.getSource("tool")) return;
    m.addSource("tool", { type: "geojson", data: empty });
    m.addLayer({ id: "tool-fill", type: "fill", source: "tool", filter: ["==", "$type", "Polygon"], paint: { "fill-color": "#3BA3FF", "fill-opacity": 0.18 } });
    m.addLayer({ id: "tool-line", type: "line", source: "tool", filter: ["!=", "$type", "Point"], paint: { "line-color": "#3BA3FF", "line-width": 2.5, "line-dasharray": [2, 1] } });
    m.addLayer({ id: "tool-pts", type: "circle", source: "tool", filter: ["==", "$type", "Point"], paint: { "circle-radius": 5, "circle-color": "#ffffff", "circle-stroke-color": "#3BA3FF", "circle-stroke-width": 2 } });
  }, [map, ready]);

  // clicks add points while a tool is on; a double click finishes
  useEffect(() => {
    const m = map;
    if (!m || !ready) return;
    const canvas = m.getCanvas();
    if (tool === "none") {
      delete canvas.dataset.tool;
      canvas.style.cursor = "";
      m.doubleClickZoom.enable();
      return;
    }
    canvas.dataset.tool = tool;
    canvas.style.cursor = "crosshair";
    m.doubleClickZoom.disable();
    const onClick = (e: MapMouseEvent) => setPts((p) => [...p, [e.lngLat.lng, e.lngLat.lat]]);
    const onDbl = (e: MapMouseEvent) => {
      e.preventDefault();
      if (toolRef.current === "profile") void buildProfile();
      else setTool("none");
    };
    m.on("click", onClick);
    m.on("dblclick", onDbl);
    return () => {
      m.off("click", onClick);
      m.off("dblclick", onDbl);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, ready, tool]);

  // redraw the shape
  useEffect(() => {
    const src = map?.getSource("tool") as GeoJSONSource | undefined;
    if (!src) return;
    const features: GeoJSON.Feature[] = pts.map((p) => ({ type: "Feature", properties: {}, geometry: { type: "Point", coordinates: p } }));
    if (tool === "area" && pts.length >= 3) features.unshift({ type: "Feature", properties: {}, geometry: { type: "Polygon", coordinates: [[...pts, pts[0]]] } });
    else if (pts.length >= 2) features.unshift({ type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: pts } });
    src.setData({ type: "FeatureCollection", features });
  }, [map, pts, tool]);

  function choose(t: Tool) {
    setPts([]);
    setProfile(null);
    setTool((cur) => (cur === t ? "none" : t));
  }

  async function buildProfile() {
    const p = ptsRef.current;
    if (p.length < 2) return;
    setBusy(tr("Считаю высоты…"));
    try {
      const { elevationProfile } = await import("@/lib/elevation");
      setProfile(await elevationProfile(p));
    } catch {
      setProfile([]);
    } finally {
      setBusy("");
      setTool("none");
    }
  }

  async function save(kind: "png" | "pdf") {
    if (!map || !shell) return;
    setBusy(tr("Готовлю файл…"));
    try {
      const { captureMap, framed, downloadCanvas, downloadPdf } = await import("@/lib/mapExport");
      const shot = await captureMap(map, shell);
      const date = new Date().toLocaleDateString(loc(), { day: "2-digit", month: "2-digit", year: "numeric" });
      const c = framed(shot, map, title, `BASK Metals and Mining · ${date} · © OpenStreetMap, Esri, OpenTopoMap`);
      const name = `${title.replace(/[\\/:*?"<>|]+/g, " ").trim() || "map"} ${date}`;
      if (kind === "png") downloadCanvas(c, `${name}.png`);
      else await downloadPdf(c, `${name}.pdf`);
    } catch {
      alert(tr("Не удалось сохранить карту. Некоторые подложки не разрешают копировать снимок: переключите подложку и попробуйте ещё раз."));
    } finally {
      setBusy("");
    }
  }

  const length = pts.length >= 2 ? turfLength(lineString(pts), { units: "kilometers" }) : 0;
  const areaKm2 = tool === "area" && pts.length >= 3 ? turfArea(polygon([[...pts, pts[0]]])) / 1e6 : 0;
  const btn = (on: boolean) => `map-tool-btn${on ? " is-active" : ""}`;

  return (
    <>
      <div className="map-tools" role="toolbar" aria-label={tr("Инструменты карты")}>
        <button type="button" className={btn(tool === "measure")} aria-pressed={tool === "measure"} onClick={() => choose("measure")} title={tr("Линейка: нажимайте на точки на карте, двойной щелчок — закончить")}>
          📏 <span>{tr("Линейка")}</span>
        </button>
        <button type="button" className={btn(tool === "area")} aria-pressed={tool === "area"} onClick={() => choose("area")} title={tr("Площадь: обведите область точками, двойной щелчок — закончить")}>
          ⬠ <span>{tr("Площадь")}</span>
        </button>
        <button type="button" className={btn(tool === "profile")} aria-pressed={tool === "profile"} onClick={() => choose("profile")} title={tr("Профиль рельефа: проведите линию, двойной щелчок — построить график высот")}>
          ⛰ <span>{tr("Профиль")}</span>
        </button>
        <button type="button" className={btn(compare)} aria-pressed={compare} onClick={() => setCompare((v) => !v)} title={tr("Шторка: сравнить две подложки, двигая линию")}>
          ◧ <span>{tr("Сравнить")}</span>
        </button>
        <button type="button" className={btn(false)} onClick={() => save("png")} disabled={!!busy} title={tr("Сохранить карту картинкой")}>
          🖼 <span>PNG</span>
        </button>
        <button type="button" className={btn(false)} onClick={() => save("pdf")} disabled={!!busy} title={tr("Сохранить карту в PDF для отчёта")}>
          📄 <span>PDF</span>
        </button>
      </div>

      {(tool !== "none" || busy || pts.length > 0) && (
        <div className="map-tool-info" role="status">
          {busy ? (
            busy
          ) : tool === "measure" || (tool === "none" && pts.length >= 2 && !profile) ? (
            <>
              {pts.length < 2 ? tr("Нажмите на карту, чтобы поставить первую точку") : <b>{km(length)}</b>}
              {pts.length >= 2 && <span> · {tr("точек: {0}", { 0: pts.length })}</span>}
            </>
          ) : tool === "area" ? (
            pts.length < 3 ? (
              tr("Поставьте не меньше трёх точек вокруг области")
            ) : (
              <>
                <b>{nf(areaKm2, areaKm2 < 10 ? 3 : 1)} {tr("км²")}</b> · {nf(areaKm2 * 100, 0)} {tr("га")}
              </>
            )
          ) : tool === "profile" ? (
            pts.length < 2 ? (
              tr("Поставьте точки вдоль будущей дороги или ЛЭП, двойной щелчок — построить профиль")
            ) : (
              <>
                <b>{km(length)}</b>{" "}
                <button type="button" className="map-tool-link" onClick={buildProfile}>
                  {tr("Построить профиль")}
                </button>
              </>
            )
          ) : null}
          {!busy && pts.length > 0 && (
            <button type="button" className="map-tool-link" onClick={() => (setPts([]), setProfile(null))}>
              {tr("Очистить")}
            </button>
          )}
        </div>
      )}

      {compare && map && shell && <Swipe map={map} shell={shell} baseStyle={baseStyle} left={basemap} data={contours} />}

      {profile && (
        <div className="map-profile">
          <ElevationChart points={profile} onClose={() => (setProfile(null), setPts([]))} />
        </div>
      )}
    </>
  );
}

/** A second map over the first, cut by a vertical line; it follows the first map's position. */
function Swipe({ map, shell, baseStyle, left, data }: { map: maplibregl.Map; shell: HTMLDivElement; baseStyle: () => StyleSpecification; left: Basemap; data: GeoJSON.FeatureCollection }) {
  const box = useRef<HTMLDivElement>(null);
  const [x, setX] = useState(50);
  const [right, setRight] = useState<Basemap>(left === "satellite" ? "topo" : "satellite");
  const other = useRef<maplibregl.Map | null>(null);

  useEffect(() => {
    if (!box.current) return;
    const style = baseStyle();
    const o = new maplibregl.Map({
      container: box.current,
      style,
      center: map.getCenter(),
      zoom: map.getZoom(),
      bearing: map.getBearing(),
      pitch: map.getPitch(),
      interactive: false,
      attributionControl: false,
    });
    const sync = () => o.jumpTo({ center: map.getCenter(), zoom: map.getZoom(), bearing: map.getBearing(), pitch: map.getPitch() });
    map.on("move", sync);
    o.on("load", () => {
      // the contours on the right side too
      o.addSource("licenses", { type: "geojson", data });
      o.addLayer({ id: "lic-line", type: "line", source: "licenses", paint: { "line-color": ["coalesce", ["get", "color"], "#C9A45C"], "line-width": 2.5 } });
      other.current = o;
      (["scheme", "satellite", "topo"] as Basemap[]).forEach((id) => o.setLayoutProperty(id, "visibility", id === right ? "visible" : "none"));
    });
    return () => {
      map.off("move", sync);
      o.remove();
      other.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map]);

  useEffect(() => {
    const o = other.current;
    if (!o || !o.isStyleLoaded()) return;
    (["scheme", "satellite", "topo"] as Basemap[]).forEach((id) => o.setLayoutProperty(id, "visibility", id === right ? "visible" : "none"));
  }, [right]);

  function drag(e: React.PointerEvent) {
    const r = shell.getBoundingClientRect();
    const move = (ev: PointerEvent) => setX(Math.min(98, Math.max(2, ((ev.clientX - r.left) / r.width) * 100)));
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    e.preventDefault();
  }

  return (
    <>
      <div ref={box} className="map-swipe-layer" style={{ clipPath: `inset(0 0 0 ${x}%)` }} />
      <div className="map-swipe-line" style={{ left: `${x}%` }}>
        <button type="button" className="map-swipe-handle" onPointerDown={drag} aria-label={tr("Сдвинуть шторку")}
          onKeyDown={(e) => (e.key === "ArrowLeft" ? setX((v) => Math.max(2, v - 2)) : e.key === "ArrowRight" ? setX((v) => Math.min(98, v + 2)) : null)}>
          ⟷
        </button>
      </div>
      <select className="map-swipe-select" value={right} onChange={(e) => setRight(e.target.value as Basemap)} aria-label={tr("Подложка справа")}>
        <option value="scheme">{tr("Справа: схема")}</option>
        <option value="satellite">{tr("Справа: спутник")}</option>
        <option value="topo">{tr("Справа: топо")}</option>
      </select>
    </>
  );
}
