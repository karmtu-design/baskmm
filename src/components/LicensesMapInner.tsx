"use client";

import { useEffect, useMemo } from "react";
import { MapContainer, TileLayer, Polygon, Tooltip, Popup, LayersControl, useMap } from "react-leaflet";
import L from "leaflet";
import Link from "next/link";
import type { Contour } from "@/lib/types";
import { mineralColor } from "@/lib/types";
import { toLatLngs } from "@/lib/coords";

export type MapLicense = {
  id: number;
  deposit_name: string | null;
  license_number: string;
  mineral: string | null;
  company_name: string;
  license_type: string | null;
  status: string | null;
  contour: Contour | null;
};

const KZ_BOUNDS: L.LatLngBoundsExpression = [
  [40.5, 46.5],
  [55.5, 87.5],
];

function FitTo({ licenses, preview }: { licenses: MapLicense[]; preview?: Contour | null }) {
  const map = useMap();
  useEffect(() => {
    const all: [number, number][] = [];
    licenses.forEach((l) => l.contour && toLatLngs(l.contour).forEach((r) => all.push(...r)));
    if (preview) toLatLngs(preview).forEach((r) => all.push(...r));
    if (all.length) map.fitBounds(L.latLngBounds(all), { padding: [40, 40], maxZoom: 13 });
    else map.fitBounds(KZ_BOUNDS);
  }, [map, licenses, preview]);
  return null;
}

export default function LicensesMapInner({
  licenses,
  height = 520,
  showLabels = true,
  preview,
  linkToLicense = true,
}: {
  licenses: MapLicense[];
  height?: number;
  showLabels?: boolean;
  preview?: Contour | null;
  linkToLicense?: boolean;
}) {
  const withContour = useMemo(() => licenses.filter((l) => l.contour), [licenses]);

  return (
    <div style={{ height }} className="overflow-hidden rounded-lg border border-line">
      <MapContainer bounds={KZ_BOUNDS} scrollWheelZoom style={{ height: "100%", width: "100%" }}>
        <LayersControl position="topright">
          <LayersControl.BaseLayer checked name="Схема">
            <TileLayer
              attribution='&copy; участники <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
          </LayersControl.BaseLayer>
          <LayersControl.BaseLayer name="Спутник">
            <TileLayer
              attribution="Снимки &copy; Esri, Maxar, Earthstar Geographics"
              url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
            />
          </LayersControl.BaseLayer>
          <LayersControl.BaseLayer name="Рельеф">
            <TileLayer
              attribution="&copy; OpenTopoMap (CC-BY-SA)"
              url="https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png"
            />
          </LayersControl.BaseLayer>
        </LayersControl>

        {withContour.map((l) => {
          const color = mineralColor(l.mineral);
          return (
            <Polygon
              key={l.id}
              positions={toLatLngs(l.contour!)}
              pathOptions={{ color, weight: 2.5, fillColor: color, fillOpacity: 0.28 }}
            >
              {showLabels && (
                <Tooltip permanent direction="right" offset={[8, 0]} className="license-label">
                  {l.deposit_name || l.license_number}
                </Tooltip>
              )}
              <Popup>
                <div className="min-w-48 text-[13px] leading-snug">
                  <div className="font-semibold">{l.deposit_name}</div>
                  <div className="text-muted">{l.license_number}</div>
                  <div className="mt-1">
                    {l.mineral} · {l.license_type}
                  </div>
                  <div>{l.company_name}</div>
                  {linkToLicense && (
                    <Link href={`/licenses/${l.id}`} className="mt-2 inline-block font-medium text-patina">
                      Открыть лицензию
                    </Link>
                  )}
                </div>
              </Popup>
            </Polygon>
          );
        })}

        {preview && (
          <Polygon
            positions={toLatLngs(preview)}
            pathOptions={{ color: "#B8742A", weight: 3, dashArray: "6 4", fillOpacity: 0.15 }}
          />
        )}
        <FitTo licenses={withContour} preview={preview} />
      </MapContainer>
    </div>
  );
}
