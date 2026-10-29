"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import LicensesMap, { type MapLicense } from "./LicensesMap";
import {
  contourAreaKm2,
  contourCorners,
  contourToKML,
  extractContour,
  parsePointsText,
  pointsToPolygon,
  toDMS,
  type CoordSystem,
} from "@/lib/coords";
import type { Contour } from "@/lib/types";
import { saveContour } from "@/app/(app)/actions";

const EXAMPLE = `1. 49°37'12" 80°31'05"
2. 49°38'40" 80°34'10"
3. 49°36'05" 80°35'30"
4. 49°35'20" 80°32'00"`;

export default function ContourEditor({
  license,
  licenseArea,
  contourSource,
}: {
  license: MapLicense;
  licenseArea: number | null;
  contourSource: string | null;
}) {
  const router = useRouter();
  const [mode, setMode] = useState<"points" | "file">("points");
  const [text, setText] = useState("");
  const [system, setSystem] = useState<CoordSystem>("wgs84");
  const [lonFirst, setLonFirst] = useState(false);
  const [preview, setPreview] = useState<Contour | null>(null);
  const [source, setSource] = useState("");
  const [errors, setErrors] = useState<string[]>([]);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();

  const current = license.contour;
  const shown = preview ?? current;
  const area = contourAreaKm2(shown);

  function showPoints() {
    setMessage(null);
    const r = parsePointsText(text, { system, lonFirst });
    setErrors(r.errors);
    const poly = pointsToPolygon(r.points);
    if (!poly) {
      setPreview(null);
      if (r.errors.length === 0) setErrors(["Нужно не меньше трёх угловых точек."]);
      return;
    }
    setPreview(poly);
    setSource(`Угловые точки, ${system === "sk42" ? "СК-42 → WGS-84" : "WGS-84"}`);
  }

  async function readFile(file: File) {
    setMessage(null);
    setErrors([]);
    try {
      const name = file.name.toLowerCase();
      let geo: unknown;
      if (name.endsWith(".geojson") || name.endsWith(".json")) {
        geo = JSON.parse(await file.text());
      } else {
        let xml: string;
        if (name.endsWith(".kmz")) {
          const JSZip = (await import("jszip")).default;
          const zip = await JSZip.loadAsync(file);
          const kml = Object.values(zip.files).find((f) => f.name.toLowerCase().endsWith(".kml"));
          if (!kml) throw new Error("В архиве KMZ нет файла KML");
          xml = await kml.async("string");
        } else {
          xml = await file.text();
        }
        const { kml } = await import("@tmcw/togeojson");
        geo = kml(new DOMParser().parseFromString(xml, "text/xml"));
      }
      const c = extractContour(geo);
      if (!c) throw new Error("В файле не найден ни один полигон");
      setPreview(c);
      setSource(`Файл ${file.name}`);
    } catch (e) {
      setPreview(null);
      setErrors([`Не удалось прочитать файл: ${(e as Error).message}`]);
    }
  }

  function save(c: Contour | null) {
    start(async () => {
      const r = await saveContour(license.id, c, source || "Ручной ввод");
      if (r.ok) {
        setPreview(null);
        setText("");
        setMessage({ ok: true, text: c ? "Контур сохранён." : "Контур удалён." });
        router.refresh();
      } else setMessage({ ok: false, text: `Не сохранилось: ${r.message}` });
    });
  }

  function downloadKML() {
    if (!current) return;
    const blob = new Blob([contourToKML(license.deposit_name || license.license_number, current)], {
      type: "application/vnd.google-earth.kml+xml",
    });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${(license.deposit_name || "contour").replace(/\s+/g, "_")}.kml`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  const center = current
    ? contourCorners(current).reduce((s, [x, y], _, arr) => [s[0] + y / arr.length, s[1] + x / arr.length], [0, 0])
    : null;
  const areaDiff = area && licenseArea ? ((area - licenseArea) / licenseArea) * 100 : null;
  const tab = (m: typeof mode, label: string) => (
    <button
      type="button"
      onClick={() => setMode(m)}
      aria-pressed={mode === m}
      className={`rounded-md px-3 py-1.5 text-sm ${mode === m ? "bg-patina text-white" : "border border-line bg-surface"}`}
    >
      {label}
    </button>
  );

  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_400px]">
      <div>
        <LicensesMap licenses={preview ? [] : [license]} preview={preview} height={520} linkToLicense={false} />
        <div className="mt-3 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
          <span>
            Площадь по контуру: <b>{area ? `${area.toFixed(2)} км²` : "—"}</b>
            {areaDiff != null && Math.abs(areaDiff) > 2 && (
              <span className="ml-1 text-ochre">
                ({areaDiff > 0 ? "+" : ""}
                {areaDiff.toFixed(1)}% к площади по лицензии)
              </span>
            )}
          </span>
          {preview && <span className="text-ochre">Пунктиром показан новый контур, он ещё не сохранён.</span>}
          {!preview && current && (
            <>
              <button type="button" onClick={downloadKML} className="font-medium text-patina hover:underline">
                Скачать KML для Google Earth
              </button>
              {center && (
                <a
                  href={`https://www.google.com/maps/search/?api=1&query=${center[0].toFixed(5)},${center[1].toFixed(5)}`}
                  target="_blank"
                  rel="noreferrer"
                  className="font-medium text-patina hover:underline"
                >
                  Открыть место в Google Картах
                </a>
              )}
            </>
          )}
        </div>

        {current && !preview && (
          <details className="mt-4 rounded-lg border border-line bg-surface p-4">
            <summary className="cursor-pointer text-sm font-medium">
              Угловые точки контура ({contourCorners(current).length})
            </summary>
            <div className="mt-3 overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="text-muted">
                  <tr>
                    <th className="py-1 pr-4 font-medium">Точка</th>
                    <th className="py-1 pr-4 font-medium">Северная широта</th>
                    <th className="py-1 pr-4 font-medium">Восточная долгота</th>
                    <th className="py-1 font-medium">Десятичные градусы</th>
                  </tr>
                </thead>
                <tbody>
                  {contourCorners(current).map(([x, y], i) => (
                    <tr key={i} className="border-t border-line/60">
                      <td className="py-1 pr-4">{i + 1}</td>
                      <td className="py-1 pr-4">{toDMS(y, "с.ш.", "ю.ш.")}</td>
                      <td className="py-1 pr-4">{toDMS(x, "в.д.", "з.д.")}</td>
                      <td className="py-1 text-muted">
                        {y.toFixed(6)}, {x.toFixed(6)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {contourSource && <p className="mt-2 text-xs text-muted">Источник контура: {contourSource}</p>}
          </details>
        )}
      </div>

      <div className="rounded-lg border border-line bg-surface p-5">
        <h3 className="font-semibold">{current ? "Заменить контур" : "Добавить контур участка"}</h3>
        <div className="mt-3 flex gap-2">
          {tab("points", "Угловые точки")}
          {tab("file", "Файл KML, KMZ, GeoJSON")}
        </div>

        {mode === "points" ? (
          <div className="mt-4 space-y-3 text-sm">
            <p className="text-muted">
              Вставьте точки из приложения к лицензии, по одной на строку: сначала широта, затем долгота. Подходят
              градусы-минуты-секунды и десятичные градусы, можно копировать прямо из Word или Excel.
            </p>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={8}
              placeholder={EXAMPLE}
              aria-label="Угловые точки"
              className="w-full rounded-md border border-line bg-white px-3 py-2"
            />
            <label className="block">
              Система координат в документе
              <select
                value={system}
                onChange={(e) => setSystem(e.target.value as CoordSystem)}
                className="mt-1 w-full rounded-md border border-line bg-white px-3 py-2"
              >
                <option value="wgs84">WGS-84 (современные лицензии, GPS)</option>
                <option value="sk42">СК-42, Пулково-1942 (старые документы)</option>
              </select>
            </label>
            <label className="inline-flex items-center gap-2">
              <input type="checkbox" checked={lonFirst} onChange={(e) => setLonFirst(e.target.checked)} />
              В строке сначала долгота, затем широта
            </label>
            <div>
              <button
                type="button"
                onClick={showPoints}
                disabled={!text.trim()}
                className="rounded-md border border-patina px-3.5 py-2 font-medium text-patina disabled:opacity-40"
              >
                Показать на карте
              </button>
            </div>
          </div>
        ) : (
          <div className="mt-4 space-y-3 text-sm">
            <p className="text-muted">
              Выберите файл с контуром: KML или KMZ из Google Earth, либо GeoJSON из ГИС-программы.
            </p>
            <input
              type="file"
              accept=".kml,.kmz,.geojson,.json"
              onChange={(e) => e.target.files?.[0] && readFile(e.target.files[0])}
              className="block w-full text-sm"
            />
          </div>
        )}

        {errors.length > 0 && (
          <ul className="mt-4 space-y-1 text-sm text-danger" role="alert">
            {errors.slice(0, 6).map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
        )}

        {preview && (
          <div className="mt-5 flex flex-wrap gap-2 border-t border-line pt-4">
            <button
              type="button"
              onClick={() => save(preview)}
              disabled={pending}
              className="rounded-md bg-patina px-4 py-2 text-sm font-medium text-white hover:bg-patina-deep disabled:opacity-50"
            >
              {pending ? "Сохраняется…" : "Сохранить контур"}
            </button>
            <button
              type="button"
              onClick={() => setPreview(null)}
              className="rounded-md border border-line px-4 py-2 text-sm"
            >
              Отменить
            </button>
          </div>
        )}

        {current && !preview && (
          <button
            type="button"
            onClick={() => confirm("Удалить контур этого участка?") && save(null)}
            className="mt-6 text-sm text-danger hover:underline"
          >
            Удалить контур
          </button>
        )}

        {message && (
          <p className={`mt-4 text-sm ${message.ok ? "text-patina" : "text-danger"}`} role="status">
            {message.text}
          </p>
        )}
      </div>
    </div>
  );
}
