"use client";

// Saving what is on the map as a picture (PNG) or a one-page PDF for reports:
// the map itself, the labels drawn on top of it, a title, scale, date and the data sources.
import type { Map as MlMap } from "maplibre-gl";

/** Draws the current map with its HTML labels into a canvas (at the screen's pixel density). */
export async function captureMap(m: MlMap, container: HTMLElement): Promise<HTMLCanvasElement> {
  // the WebGL picture is only readable right after a frame is drawn
  const shot = await new Promise<HTMLCanvasElement>((resolve) => {
    m.once("render", () => {
      const src = m.getCanvas();
      const c = document.createElement("canvas");
      c.width = src.width;
      c.height = src.height;
      c.getContext("2d")!.drawImage(src, 0, 0);
      resolve(c);
    });
    m.triggerRepaint();
  });
  const k = shot.width / container.clientWidth;
  const g = shot.getContext("2d")!;
  const box = container.getBoundingClientRect();
  g.textBaseline = "middle";
  // labels of sites and places are HTML on top of the map: copy them as text with a light plate
  container.querySelectorAll<HTMLElement>(".map-label, .map-place").forEach((el) => {
    const r = el.getBoundingClientRect();
    if (r.right < box.left || r.left > box.right || r.bottom < box.top || r.top > box.bottom) return;
    const x = (r.left - box.left) * k,
      y = (r.top - box.top) * k,
      w = r.width * k,
      h = r.height * k;
    g.fillStyle = "rgba(255,255,255,0.88)";
    g.beginPath();
    g.roundRect(x, y, w, h, 5 * k);
    g.fill();
    g.fillStyle = "#1b1f24";
    g.font = `${el.classList.contains("map-label") ? 600 : 500} ${12 * k}px system-ui, sans-serif`;
    g.fillText(el.textContent ?? "", x + 6 * k, y + h / 2, w - 8 * k);
  });
  return shot;
}

function scaleText(m: MlMap): string {
  const c = m.getContainer();
  const y = c.clientHeight / 2;
  const a = m.unproject([0, y]),
    b = m.unproject([100, y]);
  const metres = a.distanceTo(b);
  return metres >= 1000 ? `100 px ≈ ${(metres / 1000).toFixed(metres >= 10000 ? 0 : 1)} km` : `100 px ≈ ${Math.round(metres)} m`;
}

/** Adds a white frame with the title above and the date, scale and sources below. */
export function framed(map: HTMLCanvasElement, m: MlMap, title: string, footer: string): HTMLCanvasElement {
  const k = map.width / m.getContainer().clientWidth;
  const pad = 16 * k,
    top = 44 * k,
    bottom = 34 * k;
  const c = document.createElement("canvas");
  c.width = map.width + pad * 2;
  c.height = map.height + top + bottom;
  const g = c.getContext("2d")!;
  g.fillStyle = "#ffffff";
  g.fillRect(0, 0, c.width, c.height);
  g.fillStyle = "#14181d";
  g.textBaseline = "middle";
  g.font = `600 ${18 * k}px system-ui, sans-serif`;
  g.fillText(title, pad, top / 2, c.width - pad * 2);
  g.drawImage(map, pad, top);
  g.strokeStyle = "#d0d4d9";
  g.lineWidth = k;
  g.strokeRect(pad, top, map.width, map.height);
  g.fillStyle = "#5b6470";
  g.font = `${11 * k}px system-ui, sans-serif`;
  g.fillText(`${footer} · ${scaleText(m)}`, pad, top + map.height + bottom / 2, c.width - pad * 2);
  return c;
}

export function downloadCanvas(c: HTMLCanvasElement, name: string) {
  c.toBlob((b) => {
    if (!b) return;
    const a = document.createElement("a");
    a.href = URL.createObjectURL(b);
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }, "image/png");
}

/** A4 landscape PDF with the framed map picture centred on the page. */
export async function downloadPdf(c: HTMLCanvasElement, name: string) {
  const { PDFDocument } = await import("pdf-lib");
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([841.89, 595.28]);
  const png = await pdf.embedPng(await new Promise<ArrayBuffer>((res) => c.toBlob((b) => b!.arrayBuffer().then(res), "image/png")));
  const s = Math.min((841.89 - 48) / png.width, (595.28 - 48) / png.height);
  const w = png.width * s,
    h = png.height * s;
  page.drawImage(png, { x: (841.89 - w) / 2, y: (595.28 - h) / 2, width: w, height: h });
  const bytes = await pdf.save();
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([bytes as BlobPart], { type: "application/pdf" }));
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}
