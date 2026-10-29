"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Button, Column, Heading, Row, Text } from "@once-ui-system/core";
import type { MapOverlay } from "./LicensesMap";
import { bufferZone, findNearby, findOverlaps, km2, type Nearby } from "@/lib/geo";
import type { Contour } from "@/lib/types";

type Lic = { id: number; deposit_name: string | null; license_number: string; company_name: string; contour: Contour | null };

const fmt = (n: number, d = 1) => n.toLocaleString("ru-RU", { maximumFractionDigits: d, minimumFractionDigits: d });

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Column gap="8" paddingTop="16" borderTop>
      <Heading as="h4" variant="label-strong-m">
        {title}
      </Heading>
      {children}
    </Column>
  );
}

export default function GeoAnalysisPanel({
  license,
  others,
  overlay,
  onOverlay,
}: {
  license: Lic;
  others: Lic[];
  overlay: MapOverlay;
  onOverlay: (o: MapOverlay) => void;
}) {
  const contour = license.contour;
  const overlaps = useMemo(() => (contour ? findOverlaps([license, ...others.filter((o) => o.id !== license.id)], license.id) : []), [license, others, contour]);
  const [bufKm, setBufKm] = useState("1");
  const [radius, setRadius] = useState("40");
  const [nearby, setNearby] = useState<Nearby | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  if (!contour)
    return (
      <Text variant="body-default-s" onBackground="neutral-weak">
        Геоанализ появится после того, как у участка будет контур.
      </Text>
    );

  const showOverlaps = () => onOverlay({ ...overlay, highlight: overlay.highlight?.length ? [] : overlaps.map((o) => o.shape) });
  const makeBuffer = () => {
    const w = Number(bufKm.replace(",", "."));
    if (!(w > 0 && w <= 100)) return;
    onOverlay({ ...overlay, buffer: bufferZone(contour, w) });
  };
  async function searchNearby() {
    setLoading(true);
    setError("");
    try {
      const n = await findNearby(contour!, Number(radius));
      setNearby(n);
      onOverlay({
        ...overlay,
        points: n.places.map((p) => ({ name: p.name, lon: p.lon, lat: p.lat, kind: p.kind })),
        lines: [
          ...n.roads.map((r) => ({ name: r.name, coordinates: r.coordinates, kind: r.kind })),
          ...(n.rail ? [{ name: n.rail.name, coordinates: n.rail.coordinates, kind: "ж/д" }] : []),
        ],
      });
    } catch (e) {
      setError(`Не удалось получить данные OpenStreetMap: ${(e as Error).message}.`);
    } finally {
      setLoading(false);
    }
  }

  const otherOf = (o: (typeof overlaps)[number]) => (o.a.id === license.id ? { other: o.b, share: o.shareA } : { other: o.a, share: o.shareB });
  const bufferArea = overlay.buffer ? km2(overlay.buffer) : null;

  return (
    <Column background="surface" border radius="l" padding="24" gap="12">
      <Heading as="h3" variant="heading-strong-m">
        Геоанализ участка
      </Heading>

      <Section title="Пересечения с другими участками группы">
        {overlaps.length === 0 ? (
          <Text variant="body-default-s" onBackground="neutral-weak">
            Контур не пересекается с другими лицензиями группы.
          </Text>
        ) : (
          <>
            {overlaps.map((o) => {
              const { other, share } = otherOf(o);
              return (
                <Text key={other.id} variant="body-default-s" onBackground="danger-strong">
                  <Link href={`/licenses/${other.id}`}>{other.deposit_name || other.license_number}</Link>: общая площадь{" "}
                  {fmt(o.areaKm2, 2)} км² ({fmt(share * 100)}% этого участка)
                </Text>
              );
            })}
            <Row>
              <Button size="s" variant="secondary" onClick={showOverlaps}>
                {overlay.highlight?.length ? "Скрыть на карте" : "Показать на карте"}
              </Button>
            </Row>
          </>
        )}
      </Section>

      <Section title="Буферная зона">
        <Row gap="8" vertical="center" wrap>
          <label className="field-label" style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            Ширина, км
            <input className="field" inputMode="decimal" value={bufKm} onChange={(e) => setBufKm(e.target.value)} style={{ width: 80, minHeight: 36 }} />
          </label>
          <Button size="s" variant="secondary" onClick={makeBuffer}>
            Построить
          </Button>
          {overlay.buffer && (
            <Button size="s" variant="tertiary" onClick={() => onOverlay({ ...overlay, buffer: null })}>
              Убрать
            </Button>
          )}
        </Row>
        {bufferArea != null && (
          <Text variant="body-default-s" onBackground="neutral-weak">
            Площадь участка вместе с зоной: {fmt(bufferArea, 2)} км², сама зона: {fmt(bufferArea - km2(contour), 2)} км².
          </Text>
        )}
      </Section>

      <Section title="Населённые пункты и инфраструктура рядом">
        <Row gap="8" vertical="center" wrap>
          <select className="field" aria-label="Радиус поиска" value={radius} onChange={(e) => setRadius(e.target.value)} style={{ width: "auto", minHeight: 36 }}>
            <option value="20">в радиусе 20 км</option>
            <option value="40">в радиусе 40 км</option>
            <option value="80">в радиусе 80 км</option>
          </select>
          <Button size="s" variant="secondary" onClick={searchNearby} loading={loading} prefixIcon="search">
            Найти
          </Button>
        </Row>
        {error && (
          <Text variant="body-default-s" onBackground="danger-strong">
            {error}
          </Text>
        )}
        {nearby && (
          <Column gap="8" textVariant="body-default-s">
            <div>
              <b>Населённые пункты:</b>{" "}
              {nearby.places.length
                ? nearby.places.map((p) => `${p.name} (${p.kind}, ${fmt(p.km)} км)`).join("; ")
                : "в радиусе не найдено"}
            </div>
            <div>
              <b>Дороги:</b>{" "}
              {nearby.roads.length ? nearby.roads.map((r) => `${r.name} — ${fmt(r.km)} км`).join("; ") : "в радиусе не найдено"}
            </div>
            <div>
              <b>Железная дорога:</b> {nearby.rail ? `${nearby.rail.name} — ${fmt(nearby.rail.km)} км` : "в радиусе не найдено"}
            </div>
            <div>
              <b>ЛЭП:</b> {nearby.power ? `${nearby.power.name} — ${fmt(nearby.power.km)} км` : "в радиусе не найдено"}
            </div>
            <Text variant="body-default-xs" onBackground="neutral-weak">
              Расстояние считается от границы участка. Источник: OpenStreetMap, данные по Казахстану бывают неполными.
            </Text>
          </Column>
        )}
      </Section>
    </Column>
  );
}
