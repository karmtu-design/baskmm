"use client";

import { tr, loc } from "@/i18n";

import { useMemo } from "react";
import Link from "next/link";
import { Column, Heading, Text } from "@once-ui-system/core";
import LicensesMap from "./LicensesMap";
import { findOverlaps, km2, nearestNeighbours } from "@/lib/geo";
import type { License } from "@/lib/types";

const fmt = (n: number, d = 1) => n.toLocaleString(loc(), { maximumFractionDigits: d, minimumFractionDigits: d });
const name = (l: { id: number; deposit_name: string | null; license_number: string }) => (
  <Link href={`/licenses/${l.id}`}>{l.deposit_name || l.license_number}</Link>
);

export default function PortfolioGeo({ licenses }: { licenses: License[] }) {
  const overlaps = useMemo(() => findOverlaps(licenses), [licenses]);
  const neighbours = useMemo(() => nearestNeighbours(licenses), [licenses]);
  const overlay = useMemo(() => ({ highlight: overlaps.map((o) => o.shape) }), [overlaps]);
  const total = licenses.reduce((s, l) => s + (l.contour ? km2(l.contour) : 0), 0);
  const noShape = licenses.filter((l) => !l.contour);

  return (
    <Column gap="32">
      <Text variant="body-default-m" onBackground="neutral-weak">{tr("Площадь всех контуров:")}{" "}<b>{fmt(total)}{" "}{tr("км²")}</b>{tr(". Красным на карте показаны места, где участки группы пересекаются.")}{noShape.length > 0 && tr(" Без контура и поэтому не учтены: {0}.", { 0: noShape.map((l) => l.deposit_name || l.license_number).join(", ") })}
      </Text>

      <LicensesMap licenses={licenses} height={520} overlay={overlay} />

      <Column gap="12">
        <Heading as="h2" variant="heading-strong-l">{tr("Пересечения участков")}</Heading>
        {overlaps.length === 0 ? (
          <Text onBackground="neutral-weak">{tr("Контуры участков группы не пересекаются.")}</Text>
        ) : (
          <div className="data-table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>{tr("Участок")}</th>
                  <th>{tr("Пересекается с")}</th>
                  <th>{tr("Общая площадь, км²")}</th>
                  <th>{tr("Доля первого")}</th>
                  <th>{tr("Доля второго")}</th>
                </tr>
              </thead>
              <tbody>
                {overlaps.map((o) => (
                  <tr key={`${o.a.id}-${o.b.id}`}>
                    <td>
                      {name(o.a)}
                      <div style={{ fontSize: 12, color: "var(--neutral-on-background-weak)" }}>{o.a.company_name}</div>
                    </td>
                    <td>
                      {name(o.b)}
                      <div style={{ fontSize: 12, color: "var(--neutral-on-background-weak)" }}>{o.b.company_name}</div>
                    </td>
                    <td>{fmt(o.areaKm2, 2)}</td>
                    <td>{fmt(o.shareA * 100)}%</td>
                    <td>{fmt(o.shareB * 100)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Column>

      <Column gap="12">
        <Heading as="h2" variant="heading-strong-l">{tr("Ближайший соседний участок")}</Heading>
        <Text variant="body-default-s" onBackground="neutral-weak">{tr("Расстояние между границами. Пригодится, чтобы планировать общую инфраструктуру и логистику для соседних объектов.")}</Text>
        <div className="data-table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>{tr("Участок")}</th>
                <th>{tr("Площадь, км²")}</th>
                <th>{tr("Ближайший участок группы")}</th>
                <th>{tr("Расстояние, км")}</th>
              </tr>
            </thead>
            <tbody>
              {neighbours.map(({ license, nearest }) => (
                <tr key={license.id}>
                  <td>{name(license)}</td>
                  <td>{fmt(km2(license.contour!), 2)}</td>
                  <td>{name(nearest!.other)}</td>
                  <td>{nearest!.km === 0 ? tr("граничат или пересекаются") : fmt(nearest!.km)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Column>
    </Column>
  );
}
