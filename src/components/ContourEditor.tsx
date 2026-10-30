"use client";

import { tr } from "@/i18n";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button, Checkbox, Column, Grid, Heading, Row, SegmentedControl, Text } from "@once-ui-system/core";
import LicensesMap, { type MapLicense, type MapOverlay } from "./LicensesMap";
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
import { GK_ZONES, UTM_ZONES, crsFromKey, crsKey, crsLabel, guessCrs, toContour, type RawPolygons } from "@/lib/geoImport";
import { saveContour } from "@/app/(app)/actions";

const EXAMPLE = `1. 49°37'12" 80°31'05"
2. 49°38'40" 80°34'10"
3. 49°36'05" 80°35'30"
4. 49°35'20" 80°32'00"`;

export default function ContourEditor({
  license,
  licenseArea,
  contourSource,
  overlay,
  aside,
}: {
  license: MapLicense;
  licenseArea: number | null;
  contourSource: string | null;
  overlay?: MapOverlay;
  aside?: React.ReactNode;
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
  // a Shapefile/DXF read in its own coordinates, shown once its coordinate system is known
  const [raw, setRaw] = useState<{ polys: RawPolygons; name: string } | null>(null);
  const [crs, setCrs] = useState("");
  const [swapped, setSwapped] = useState(false);
  const [crsNote, setCrsNote] = useState("");

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
      if (r.errors.length === 0) setErrors([tr("Нужно не меньше трёх угловых точек.")]);
      return;
    }
    setPreview(poly);
    setSource(tr("Угловые точки, {0}", { 0: system === "sk42" ? "СК-42 → WGS-84" : "WGS-84" }));
  }

  function showRaw(polys: RawPolygons, name: string, key: string, swap: boolean) {
    if (!key) {
      setPreview(null);
      return;
    }
    const r = toContour(polys, crsFromKey(key), swap);
    if (!r.contour) {
      setPreview(null);
      setErrors([tr("В файле не найдено замкнутых контуров.")]);
      return;
    }
    setErrors(r.warning ? [r.warning] : []);
    setPreview(r.contour);
    setSource(tr("Файл {0}, {1}", { 0: name, 1: crsLabel(crsFromKey(key)) }));
  }

  async function readFiles(list: FileList) {
    const files = [...list];
    const exts = files.map((f) => (f.name.split(".").pop() ?? "").toLowerCase());
    setRaw(null);
    setCrsNote("");
    if (exts.some((e) => ["zip", "shp", "dxf"].includes(e))) {
      setMessage(null);
      setErrors([]);
      try {
        const { readDxf, readShapefile } = await import("@/lib/geoImport");
        const dxf = files.find((f) => f.name.toLowerCase().endsWith(".dxf"));
        let polys: RawPolygons;
        let projected = false;
        if (dxf) polys = await readDxf(dxf);
        else ({ polys, projected } = await readShapefile(files));
        if (!polys.length) throw new Error(dxf ? tr("в чертеже нет замкнутых полилиний") : tr("в файле нет полигонов"));
        const name = (dxf ?? files[0]).name;
        const g = projected ? { crs: { kind: "wgs84" as const }, swapped: false } : guessCrs(polys);
        const key = g.crs ? crsKey(g.crs) : "";
        setRaw({ polys, name });
        setCrs(key);
        setSwapped(g.swapped);
        setCrsNote(
          projected
            ? tr("Система координат взята из файла .prj, контур пересчитан в WGS-84.")
            : g.crs
              ? tr("Система координат определена по числам: {0}. Если контур встал не туда, выберите другую.", { 0: crsLabel(g.crs) })
              : tr("В файле нет сведений о системе координат. Выберите её ниже: обычно она указана на чертеже или в паспорте участка.")
        );
        showRaw(polys, name, key, g.swapped);
      } catch (e) {
        setPreview(null);
        setErrors([tr("Не удалось прочитать файл: {0}", { 0: (e as Error).message })]);
      }
      return;
    }
    return readFile(files[0]);
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
          if (!kml) throw new Error(tr("В архиве KMZ нет файла KML"));
          xml = await kml.async("string");
        } else {
          xml = await file.text();
        }
        const { kml } = await import("@tmcw/togeojson");
        geo = kml(new DOMParser().parseFromString(xml, "text/xml"));
      }
      const c = extractContour(geo);
      if (!c) throw new Error(tr("В файле не найден ни один полигон"));
      setPreview(c);
      setSource(tr("Файл {0}", { 0: file.name }));
    } catch (e) {
      setPreview(null);
      setErrors([tr("Не удалось прочитать файл: {0}", { 0: (e as Error).message })]);
    }
  }

  function save(c: Contour | null) {
    start(async () => {
      const r = await saveContour(license.id, c, source || tr("Ручной ввод"));
      if (r.ok) {
        setPreview(null);
        setText("");
        setMessage({ ok: true, text: c ? tr("Контур сохранён.") : tr("Контур удалён.") });
        router.refresh();
      } else setMessage({ ok: false, text: tr("Не сохранилось: {0}", { 0: r.message }) });
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
  const weak = { color: "var(--neutral-on-background-weak)" };
  const warn = { color: "var(--warning-on-background-strong)" };

  return (
    <Grid columns="3" gap="24" m={{ columns: "1" }}>
      <Column gap="12" className="span-2">
        <LicensesMap licenses={preview ? [] : [license]} preview={preview} height={560} linkToLicense={false} overlay={overlay} />
        <Row wrap gap="24" vertical="center" textVariant="body-default-s">
          <span>{tr("Площадь по контуру:")}{" "}<b>{area ? tr("{0} км²", { 0: area.toFixed(2) }) : "—"}</b>
            {areaDiff != null && Math.abs(areaDiff) > 2 && (
              <span style={{ ...warn, marginLeft: 4 }}>
                ({areaDiff > 0 ? "+" : ""}
                {areaDiff.toFixed(1)}{tr("% к площади по лицензии)")}</span>
            )}
          </span>
          {preview && <span style={warn}>{tr("Пунктиром показан новый контур, он ещё не сохранён.")}</span>}
          {!preview && current && (
            <>
              <Button variant="tertiary" size="s" prefixIcon="download" onClick={downloadKML}>{tr("Скачать KML для Google Earth")}</Button>
              {center && (
                <Button
                  variant="tertiary"
                  size="s"
                  suffixIcon="arrowUpRight"
                  href={`https://www.google.com/maps/search/?api=1&query=${center[0].toFixed(5)},${center[1].toFixed(5)}`}
                >{tr("Открыть в Google Картах")}</Button>
              )}
            </>
          )}
        </Row>

        {current && !preview && (
          <Column background="surface" border radius="l" padding="16">
            <details>
              <summary>{tr("Угловые точки контура (")}{contourCorners(current).length})</summary>
              <div style={{ overflowX: "auto", marginTop: 12 }}>
                <table className="data-table" style={{ minWidth: 560 }}>
                  <thead>
                    <tr>
                      <th>{tr("Точка")}</th>
                      <th>{tr("Северная широта")}</th>
                      <th>{tr("Восточная долгота")}</th>
                      <th>{tr("Десятичные градусы")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {contourCorners(current).map(([x, y], i) => (
                      <tr key={i}>
                        <td>{i + 1}</td>
                        <td>{toDMS(y, tr("с.ш."), tr("ю.ш."))}</td>
                        <td>{toDMS(x, tr("в.д."), tr("з.д."))}</td>
                        <td style={weak}>
                          {y.toFixed(6)}, {x.toFixed(6)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {contourSource && (
                <Text as="p" variant="body-default-xs" onBackground="neutral-weak" marginTop="8">{tr("Источник контура:")}{" "}{contourSource}
                </Text>
              )}
            </details>
          </Column>
        )}
      </Column>

      <Column gap="24">
      <Column background="surface" border radius="l" padding="24" gap="16" fitHeight>
        <Heading as="h2" variant="heading-strong-m">
          {current ? tr("Заменить контур") : tr("Добавить контур участка")}
        </Heading>
        <SegmentedControl
          value={mode}
          onChange={(v) => setMode(v as typeof mode)}
          buttons={[
            { value: "points", label: tr("Угловые точки") },
            { value: "file", label: tr("Файл: KML, Shapefile, DXF") },
          ]}
        />

        {mode === "points" ? (
          <Column gap="12">
            <Text variant="body-default-s" onBackground="neutral-weak">{tr("Вставьте точки из приложения к лицензии, по одной на строку: сначала широта, затем долгота. Подходят градусы-минуты-секунды и десятичные градусы, можно копировать прямо из Word или Excel.")}</Text>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={8}
              placeholder={EXAMPLE}
              aria-label={tr("Угловые точки")}
              className="field"
            />
            <label className="field-label">{tr("Система координат в документе")}<select value={system} onChange={(e) => setSystem(e.target.value as CoordSystem)} className="field">
                <option value="wgs84">{tr("WGS-84 (современные лицензии, GPS)")}</option>
                <option value="sk42">{tr("СК-42, Пулково-1942 (старые документы)")}</option>
              </select>
            </label>
            <Checkbox label={tr("В строке сначала долгота, затем широта")} checked={lonFirst} onToggle={setLonFirst} />
            <Row>
              <Button variant="secondary" prefixIcon="eye" onClick={showPoints} disabled={!text.trim()}>{tr("Показать на карте")}</Button>
            </Row>
          </Column>
        ) : (
          <Column gap="12">
            <Text variant="body-default-s" onBackground="neutral-weak">{tr("Подойдут: KML или KMZ из Google Earth; GeoJSON; Shapefile из ArcGIS, QGIS или MapInfo (ZIP-архив со всеми частями, либо файлы .shp, .prj и .dbf, выбранные вместе); чертёж AutoCAD в формате DXF (берутся замкнутые полилинии).")}</Text>
            <input
              type="file"
              multiple
              accept=".kml,.kmz,.geojson,.json,.zip,.shp,.shx,.dbf,.prj,.cpg,.dxf"
              onChange={(e) => e.target.files?.length && readFiles(e.target.files)}
              className="field"
              aria-label={tr("Файл с контуром")}
            />
            {raw && (
              <Column gap="8">
                <Text variant="body-default-s">{crsNote}</Text>
                <label className="field-label">{tr("Система координат файла")}<select
                    className="field"
                    value={crs}
                    onChange={(e) => {
                      setCrs(e.target.value);
                      showRaw(raw.polys, raw.name, e.target.value, swapped);
                    }}
                  >
                    <option value="" disabled>{tr("Выберите систему координат")}</option>
                    <option value="wgs84">{tr("WGS-84, градусы (GPS, Google Earth)")}</option>
                    <optgroup label={tr("СК-42, Гаусс–Крюгер (номер зоны в начале X, например 13 512 345)")}>
                      {GK_ZONES.map((z) => (
                        <option key={`p${z}`} value={`gk:${z}:1`}>{tr("Зона")}{" "}{z}{" "}{tr("(меридиан")}{" "}{z * 6 - 3}°)
                        </option>
                      ))}
                    </optgroup>
                    <optgroup label={tr("СК-42, Гаусс–Крюгер (X без номера зоны, например 512 345)")}>
                      {GK_ZONES.map((z) => (
                        <option key={`n${z}`} value={`gk:${z}:0`}>{tr("Зона")}{" "}{z}{" "}{tr("(меридиан")}{" "}{z * 6 - 3}°)
                        </option>
                      ))}
                    </optgroup>
                    <optgroup label="WGS-84 / UTM">
                      {UTM_ZONES.map((z) => (
                        <option key={`u${z}`} value={`utm:${z}`}>
                          UTM {z}{tr("N (меридиан")}{" "}{z * 6 - 183}°)
                        </option>
                      ))}
                    </optgroup>
                  </select>
                </label>
                <Checkbox
                  label={tr("X и Y поменяны местами (сначала север, потом восток)")}
                  checked={swapped}
                  onToggle={(v) => {
                    setSwapped(v);
                    showRaw(raw.polys, raw.name, crs, v);
                  }}
                />
              </Column>
            )}
          </Column>
        )}

        {errors.length > 0 && (
          <Column as="ul" gap="4" role="alert" style={{ margin: 0, paddingLeft: 18 }}>
            {errors.slice(0, 6).map((e) => (
              <Text as="li" key={e} variant="body-default-s" onBackground="danger-strong">
                {e}
              </Text>
            ))}
          </Column>
        )}

        {preview && (
          <Row wrap gap="8" borderTop paddingTop="16">
            <Button onClick={() => save(preview)} loading={pending} prefixIcon="check">{tr("Сохранить контур")}</Button>
            <Button variant="secondary" onClick={() => setPreview(null)}>{tr("Отменить")}</Button>
          </Row>
        )}

        {current && !preview && (
          <Row>
            <Button
              variant="danger"
              size="s"
              prefixIcon="trash"
              onClick={() => confirm(tr("Удалить контур этого участка?")) && save(null)}
            >{tr("Удалить контур")}</Button>
          </Row>
        )}

        {message && (
          <Text variant="body-default-s" onBackground={message.ok ? "success-strong" : "danger-strong"} role="status">
            {message.text}
          </Text>
        )}
      </Column>
      {aside}
      </Column>
    </Grid>
  );
}
