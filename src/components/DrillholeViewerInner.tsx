"use client";

import { useMemo, useState } from "react";
import DeckGL from "@deck.gl/react";
import { OrbitView, type OrbitViewState } from "@deck.gl/core";
import { LineLayer, PathLayer, ScatterplotLayer, TextLayer } from "@deck.gl/layers";
import { contourRing, gradeBreaks, gradeColor, makeFrame, pointAtDepth, type XYZ } from "@/lib/drill";
import type { Contour, Drillhole } from "@/lib/types";

type Segment = { path: XYZ[]; color: [number, number, number, number]; width: number; info: string };

export default function DrillholeViewerInner({
  holes,
  contour,
  element,
  cutoff,
  onlyOre,
  height = 560,
  exaggeration = 2,
}: {
  holes: Drillhole[];
  contour: Contour | null;
  element: string;
  cutoff: number;
  onlyOre: boolean;
  height?: number;
  exaggeration?: number;
}) {
  const model = useMemo(() => {
    const lon0 = holes.reduce((s, h) => s + h.lon, 0) / holes.length;
    const lat0 = holes.reduce((s, h) => s + h.lat, 0) / holes.length;
    const fr = makeFrame(lon0, lat0);
    const zRef = Math.max(...holes.map((h) => h.elevation_m ?? 0));
    const breaks = gradeBreaks(holes, element);
    const segments: Segment[] = [];
    const traces: { path: XYZ[] }[] = [];
    const collars: { pos: XYZ; label: string }[] = [];
    let minX = Infinity,
      minY = Infinity,
      maxX = -Infinity,
      maxY = -Infinity,
      minZ = Infinity;
    for (const h of holes) {
      const [x, y] = fr.toXY(h.lon, h.lat);
      const collar: XYZ = [x, y, ((h.elevation_m ?? zRef) - zRef) * exaggeration];
      const az = h.azimuth_deg ?? 0;
      const dip = h.dip_deg ?? -90;
      const at = (d: number): XYZ => {
        const p = pointAtDepth([x, y, 0], az, dip, d);
        return [p[0], p[1], collar[2] + p[2] * exaggeration];
      };
      const end = at(h.depth_m);
      traces.push({ path: [collar, end] });
      collars.push({ pos: collar, label: h.hole_id });
      for (const i of h.drill_intervals) {
        if (i.element !== element) continue;
        if (onlyOre && (i.grade ?? 0) < cutoff) continue;
        const ore = (i.grade ?? 0) >= cutoff;
        segments.push({
          path: [at(i.from_m), at(i.to_m)],
          color: gradeColor(i.grade, breaks),
          width: ore ? 9 : 4,
          info: `${h.hole_id}: ${i.from_m}–${i.to_m} м · ${i.grade ?? "нет пробы"}${i.unit ? ` ${i.unit}` : ""} ${element}${i.lithology ? ` · ${i.lithology}` : ""}`,
        });
      }
      minX = Math.min(minX, x, end[0]);
      maxX = Math.max(maxX, x, end[0]);
      minY = Math.min(minY, y, end[1]);
      maxY = Math.max(maxY, y, end[1]);
      minZ = Math.min(minZ, end[2]);
    }
    const ring = contourRing(contour)?.map(([lo, la]) => [...fr.toXY(lo, la), 0] as XYZ) ?? null;
    const holeSpan = Math.max(maxX - minX, maxY - minY, -minZ, 200);
    const holeCenter: XYZ = [(minX + maxX) / 2, (minY + maxY) / 2, minZ / 2];
    if (ring)
      ring.forEach(([x, y]) => {
        minX = Math.min(minX, x);
        maxX = Math.max(maxX, x);
        minY = Math.min(minY, y);
        maxY = Math.max(maxY, y);
      });
    // 100 m ground grid over the area
    const step = Math.max(100, Math.round((maxX - minX) / 12 / 100) * 100);
    const grid: { s: XYZ; t: XYZ }[] = [];
    const gx0 = Math.floor(minX / step) * step,
      gx1 = Math.ceil(maxX / step) * step,
      gy0 = Math.floor(minY / step) * step,
      gy1 = Math.ceil(maxY / step) * step;
    for (let gx = gx0; gx <= gx1; gx += step) grid.push({ s: [gx, gy0, 0], t: [gx, gy1, 0] });
    for (let gy = gy0; gy <= gy1; gy += step) grid.push({ s: [gx0, gy, 0], t: [gx1, gy, 0] });
    return { segments, traces, collars, ring, grid, center: holeCenter, span: holeSpan * 1.3 };
  }, [holes, contour, element, cutoff, onlyOre, exaggeration]);

  const initial: OrbitViewState = {
    target: model.center,
    rotationOrbit: -35,
    rotationX: 30,
    zoom: Math.log2(700 / model.span) - 0.2,
    minZoom: -6,
    maxZoom: 6,
  };
  const [viewState, setViewState] = useState<OrbitViewState>(initial);

  const layers = [
    new LineLayer({ id: "grid", data: model.grid, getSourcePosition: (d) => d.s, getTargetPosition: (d) => d.t, getColor: [140, 150, 160, 60], getWidth: 1 }),
    model.ring &&
      new PathLayer({ id: "contour", data: [{ path: model.ring }], getPath: (d) => d.path, getColor: [201, 164, 92, 255], getWidth: 2, widthUnits: "pixels" }),
    new PathLayer({ id: "traces", data: model.traces, getPath: (d) => d.path, getColor: [160, 170, 180, 120], getWidth: 1.5, widthUnits: "pixels", billboard: true }),
    new PathLayer<Segment>({
      id: "intervals",
      data: model.segments,
      getPath: (d) => d.path,
      getColor: (d) => d.color,
      getWidth: (d) => d.width,
      widthUnits: "pixels",
      billboard: true, // keeps vertical holes visible: the line faces the camera, not the ground
      capRounded: true,
      pickable: true,
      updateTriggers: { getColor: [element, cutoff], getWidth: [cutoff] },
    }),
    new ScatterplotLayer({ id: "collars", data: model.collars, getPosition: (d) => d.pos, getRadius: 5, radiusUnits: "pixels", getFillColor: [230, 232, 235, 255], getLineColor: [16, 24, 32, 255], stroked: true, lineWidthUnits: "pixels", getLineWidth: 1.5 }),
    new TextLayer({
      id: "labels",
      data: model.collars,
      getPosition: (d) => [d.pos[0], d.pos[1], d.pos[2] + 25],
      getText: (d) => d.label,
      getSize: 12,
      getColor: [230, 232, 235, 255],
      characterSet: "auto",
      fontFamily: "Arial, Helvetica, sans-serif",
      fontWeight: 600,
      getTextAnchor: "middle",
      background: true,
      getBackgroundColor: [16, 24, 32, 200],
      backgroundPadding: [4, 2],
    }),
  ].filter(Boolean);

  return (
    <div className="drill-shell" style={{ height }}>
      <DeckGL
        views={new OrbitView({ orbitAxis: "Z", fovy: 45 })}
        viewState={viewState}
        onViewStateChange={({ viewState: v }) => setViewState(v as OrbitViewState)}
        controller={{ inertia: true }}
        layers={layers}
        getTooltip={({ object }) => (object && "info" in object ? { text: (object as Segment).info } : null)}
      />
      <button type="button" className="drill-reset" onClick={() => setViewState({ ...initial })}>
        Сбросить вид
      </button>
      <div className="drill-hint">
        Вращение: левая кнопка мыши, сдвиг: правая, масштаб: колесо.{" "}
        {exaggeration === 1 ? "Масштаб по глубине 1:1." : `Глубина растянута в ${exaggeration} раза.`}
      </div>
    </div>
  );
}
