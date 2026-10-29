"use client";

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
  const weak = { color: "var(--neutral-on-background-weak)" };
  const warn = { color: "var(--warning-on-background-strong)" };

  return (
    <Grid columns="3" gap="24" m={{ columns: "1" }}>
      <Column gap="12" className="span-2">
        <LicensesMap licenses={preview ? [] : [license]} preview={preview} height={560} linkToLicense={false} overlay={overlay} />
        <Row wrap gap="24" vertical="center" textVariant="body-default-s">
          <span>
            Площадь по контуру: <b>{area ? `${area.toFixed(2)} км²` : "—"}</b>
            {areaDiff != null && Math.abs(areaDiff) > 2 && (
              <span style={{ ...warn, marginLeft: 4 }}>
                ({areaDiff > 0 ? "+" : ""}
                {areaDiff.toFixed(1)}% к площади по лицензии)
              </span>
            )}
          </span>
          {preview && <span style={warn}>Пунктиром показан новый контур, он ещё не сохранён.</span>}
          {!preview && current && (
            <>
              <Button variant="tertiary" size="s" prefixIcon="download" onClick={downloadKML}>
                Скачать KML для Google Earth
              </Button>
              {center && (
                <Button
                  variant="tertiary"
                  size="s"
                  suffixIcon="arrowUpRight"
                  href={`https://www.google.com/maps/search/?api=1&query=${center[0].toFixed(5)},${center[1].toFixed(5)}`}
                >
                  Открыть в Google Картах
                </Button>
              )}
            </>
          )}
        </Row>

        {current && !preview && (
          <Column background="surface" border radius="l" padding="16">
            <details>
              <summary>Угловые точки контура ({contourCorners(current).length})</summary>
              <div style={{ overflowX: "auto", marginTop: 12 }}>
                <table className="data-table" style={{ minWidth: 560 }}>
                  <thead>
                    <tr>
                      <th>Точка</th>
                      <th>Северная широта</th>
                      <th>Восточная долгота</th>
                      <th>Десятичные градусы</th>
                    </tr>
                  </thead>
                  <tbody>
                    {contourCorners(current).map(([x, y], i) => (
                      <tr key={i}>
                        <td>{i + 1}</td>
                        <td>{toDMS(y, "с.ш.", "ю.ш.")}</td>
                        <td>{toDMS(x, "в.д.", "з.д.")}</td>
                        <td style={weak}>
                          {y.toFixed(6)}, {x.toFixed(6)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {contourSource && (
                <Text as="p" variant="body-default-xs" onBackground="neutral-weak" marginTop="8">
                  Источник контура: {contourSource}
                </Text>
              )}
            </details>
          </Column>
        )}
      </Column>

      <Column gap="24">
      <Column background="surface" border radius="l" padding="24" gap="16" fitHeight>
        <Heading as="h3" variant="heading-strong-m">
          {current ? "Заменить контур" : "Добавить контур участка"}
        </Heading>
        <SegmentedControl
          value={mode}
          onChange={(v) => setMode(v as typeof mode)}
          buttons={[
            { value: "points", label: "Угловые точки" },
            { value: "file", label: "Файл KML, KMZ, GeoJSON" },
          ]}
        />

        {mode === "points" ? (
          <Column gap="12">
            <Text variant="body-default-s" onBackground="neutral-weak">
              Вставьте точки из приложения к лицензии, по одной на строку: сначала широта, затем долгота. Подходят
              градусы-минуты-секунды и десятичные градусы, можно копировать прямо из Word или Excel.
            </Text>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={8}
              placeholder={EXAMPLE}
              aria-label="Угловые точки"
              className="field"
            />
            <label className="field-label">
              Система координат в документе
              <select value={system} onChange={(e) => setSystem(e.target.value as CoordSystem)} className="field">
                <option value="wgs84">WGS-84 (современные лицензии, GPS)</option>
                <option value="sk42">СК-42, Пулково-1942 (старые документы)</option>
              </select>
            </label>
            <Checkbox label="В строке сначала долгота, затем широта" checked={lonFirst} onToggle={setLonFirst} />
            <Row>
              <Button variant="secondary" prefixIcon="eye" onClick={showPoints} disabled={!text.trim()}>
                Показать на карте
              </Button>
            </Row>
          </Column>
        ) : (
          <Column gap="12">
            <Text variant="body-default-s" onBackground="neutral-weak">
              Выберите файл с контуром: KML или KMZ из Google Earth, либо GeoJSON из ГИС-программы.
            </Text>
            <input
              type="file"
              accept=".kml,.kmz,.geojson,.json"
              onChange={(e) => e.target.files?.[0] && readFile(e.target.files[0])}
              className="field"
            />
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
            <Button onClick={() => save(preview)} loading={pending} prefixIcon="check">
              Сохранить контур
            </Button>
            <Button variant="secondary" onClick={() => setPreview(null)}>
              Отменить
            </Button>
          </Row>
        )}

        {current && !preview && (
          <Row>
            <Button
              variant="danger"
              size="s"
              prefixIcon="trash"
              onClick={() => confirm("Удалить контур этого участка?") && save(null)}
            >
              Удалить контур
            </Button>
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
