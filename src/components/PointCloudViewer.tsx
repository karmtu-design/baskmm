"use client";

// Point clouds from a drone survey or laser scanning (LAS / LAZ) in 3D, right on the page:
// rotate with the mouse, colour by height or by the survey's own colours. Read in the browser (loaders.gl).
import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import DeckGL from "@deck.gl/react";
import { OrbitView, type OrbitViewState } from "@deck.gl/core";
import { PointCloudLayer } from "@deck.gl/layers";
import { tr, loc } from "@/i18n";

const MAX_POINTS = 1_500_000;
type Cloud = { pos: Float32Array; rgb: Uint8Array | null; height: Uint8Array; n: number; total: number; size: [number, number, number]; zMin: number; zMax: number };

/** Height colours from low to high: blue → green → yellow → red. */
function ramp(t: number): [number, number, number] {
  const stops: [number, number, number][] = [
    [40, 70, 180],
    [40, 170, 120],
    [235, 210, 60],
    [215, 60, 40],
  ];
  const x = Math.min(0.9999, Math.max(0, t)) * (stops.length - 1);
  const i = Math.floor(x),
    f = x - i;
  return [0, 1, 2].map((k) => Math.round(stops[i][k] + (stops[i + 1][k] - stops[i][k]) * f)) as [number, number, number];
}

async function readCloud(buf: ArrayBuffer): Promise<Cloud> {
  const [{ parse }, { LASLoader }] = await Promise.all([import("@loaders.gl/core"), import("@loaders.gl/las")]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mesh: any = await parse(buf, LASLoader, { worker: false, las: { shape: "mesh", skip: 1, colorDepth: "auto" } });
  const src: Float32Array | Float64Array = mesh.attributes.POSITION.value;
  const col: Uint8Array | undefined = mesh.attributes.COLOR_0?.value;
  const cs = col ? col.length / (src.length / 3) : 0;
  const total = src.length / 3;
  const step = Math.max(1, Math.ceil(total / MAX_POINTS));
  const n = Math.floor(total / step);
  // centre the cloud: the coordinates are usually large projected numbers (UTM metres)
  let minX = Infinity, minY = Infinity, minZ = Infinity, maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
  for (let i = 0; i < total; i += step) {
    const x = src[i * 3], y = src[i * 3 + 1], z = src[i * 3 + 2];
    if (x < minX) minX = x; if (x > maxX) maxX = x;
    if (y < minY) minY = y; if (y > maxY) maxY = y;
    if (z < minZ) minZ = z; if (z > maxZ) maxZ = z;
  }
  const cx = (minX + maxX) / 2, cy = (minY + maxY) / 2, cz = (minZ + maxZ) / 2;
  const pos = new Float32Array(n * 3);
  const rgb = cs >= 3 ? new Uint8Array(n * 3) : null;
  const height = new Uint8Array(n * 3);
  const span = maxZ - minZ || 1;
  for (let j = 0, i = 0; j < n; j++, i += step) {
    pos[j * 3] = src[i * 3] - cx;
    pos[j * 3 + 1] = src[i * 3 + 1] - cy;
    pos[j * 3 + 2] = src[i * 3 + 2] - cz;
    if (rgb && col) {
      rgb[j * 3] = col[i * cs];
      rgb[j * 3 + 1] = col[i * cs + 1];
      rgb[j * 3 + 2] = col[i * cs + 2];
    }
    const c = ramp((src[i * 3 + 2] - minZ) / span);
    height.set(c, j * 3);
  }
  // a cloud without real colours stores zeros: treat it as having none
  const hasRgb = !!rgb && rgb.some((v) => v > 0);
  return { pos, rgb: hasRgb ? rgb : null, height, n, total, size: [maxX - minX, maxY - minY, maxZ - minZ], zMin: minZ, zMax: maxZ };
}

export default function PointCloudViewer({ url, title, onClose, onDownload }: { url: string; title: string; onClose: () => void; onDownload?: () => void }) {
  const [cloud, setCloud] = useState<Cloud | null>(null);
  const [err, setErr] = useState("");
  const [mode, setMode] = useState<"rgb" | "height">("height");
  const [size, setSize] = useState(2);
  const [zx, setZx] = useState(1);
  const [view, setView] = useState<OrbitViewState>({ target: [0, 0, 0], rotationX: 35, rotationOrbit: -30, zoom: 0 });

  useEffect(() => {
    let alive = true;
    fetch(url)
      .then((r) => {
        if (!r.ok) throw new Error(String(r.status));
        return r.arrayBuffer();
      })
      .then(readCloud)
      .then((c) => {
        if (!alive) return;
        setCloud(c);
        if (c.rgb) setMode("rgb");
        // zoom so that the whole cloud fits
        const w = Math.max(c.size[0], c.size[1], 1);
        setView((v) => ({ ...v, zoom: Math.log2(Math.min(window.innerWidth, window.innerHeight) / w / 1.3) }));
      })
      .catch((e) => alive && setErr(tr("Файл не открылся: {0}", { 0: (e as Error).message })));
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => {
      alive = false;
      window.removeEventListener("keydown", onKey);
    };
  }, [url, onClose]);

  const layer = useMemo(() => {
    if (!cloud) return null;
    const colors = mode === "rgb" && cloud.rgb ? cloud.rgb : cloud.height;
    return new PointCloudLayer({
      id: "cloud",
      data: { length: cloud.n, attributes: { getPosition: { value: cloud.pos, size: 3 }, getColor: { value: colors, size: 3, normalized: true } } },
      pointSize: size,
      sizeUnits: "pixels",
      modelMatrix: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, zx, 0, 0, 0, 0, 1],
      material: false,
      updateTriggers: { getColor: mode },
    });
  }, [cloud, mode, size, zx]);

  const nf = (v: number, d = 0) => v.toLocaleString(loc(), { maximumFractionDigits: d });
  return createPortal(
    <div className="pdf-overlay" role="dialog" aria-modal="true" aria-label={tr("Просмотр: {0}", { 0: title })}>
      <div className="pdf-bar">
        <span className="pdf-title" title={title}>
          {title}
        </span>
        <div className="pdf-tools">
          {cloud?.rgb && (
            <>
              <button type="button" className={`chip${mode === "rgb" ? " is-on" : ""}`} onClick={() => setMode("rgb")}>{tr("Цвета съёмки")}</button>
              <button type="button" className={`chip${mode === "height" ? " is-on" : ""}`} onClick={() => setMode("height")}>{tr("По высоте")}</button>
            </>
          )}
          <label className="cloud-ctl">
            {tr("Точки")}
            <input type="range" min={1} max={6} step={0.5} value={size} onChange={(e) => setSize(Number(e.target.value))} />
          </label>
          <label className="cloud-ctl">
            {tr("Рельеф ×{0}", { 0: zx })}
            <input type="range" min={1} max={5} step={0.5} value={zx} onChange={(e) => setZx(Number(e.target.value))} />
          </label>
          {onDownload && (
            <button type="button" className="chip" onClick={onDownload}>
              {tr("Скачать")}
            </button>
          )}
          <button type="button" className="nav-close" onClick={onClose} aria-label={tr("Закрыть")}>
            ×
          </button>
        </div>
      </div>
      <div className="cloud-stage">
        {err ? (
          <p className="office-msg">{err}</p>
        ) : !cloud ? (
          <p className="office-msg">{tr("Читаю облако точек… Большие файлы открываются до минуты.")}</p>
        ) : (
          <>
            <DeckGL
              views={new OrbitView({ orbitAxis: "Z", fovy: 50 })}
              viewState={view}
              onViewStateChange={({ viewState }) => setView(viewState as OrbitViewState)}
              controller
              layers={layer ? [layer] : []}
            />
            <div className="cloud-info">
              {tr("Точек: {0}", { 0: nf(cloud.total) })}
              {cloud.n < cloud.total && ` · ${tr("показано {0}", { 0: nf(cloud.n) })}`} · {nf(cloud.size[0])} × {nf(cloud.size[1])} {tr("м")} · {tr("высоты {0}–{1} м", { 0: nf(cloud.zMin, 1), 1: nf(cloud.zMax, 1) })}
              <br />
              {tr("Вращение: левая кнопка мыши, сдвиг: правая, масштаб: колесо.")}
            </div>
          </>
        )}
      </div>
    </div>,
    document.body
  );
}
