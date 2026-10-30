"use client";

import { useMemo, useState } from "react";
import ContourEditor from "./ContourEditor";
import GeoAnalysisPanel from "./GeoAnalysisPanel";
import MapLayersPanel from "./MapLayersPanel";
import type { MapLicense, MapOverlay } from "./LicensesMap";
import type { Contour, MapImage } from "@/lib/types";

type Lic = { id: number; deposit_name: string | null; license_number: string; company_name: string; contour: Contour | null };

/** The «Карта и контур» tab: the contour editor and the geo-analysis that draws on the same map. */
export default function LicenseMapTab({
  license,
  licenseArea,
  contourSource,
  others,
  images = [],
}: {
  license: MapLicense;
  licenseArea: number | null;
  contourSource: string | null;
  others: Lic[];
  images?: MapImage[];
}) {
  const [overlay, setOverlay] = useState<MapOverlay>({});
  const [shown, setShown] = useState<Record<number, number | false>>({});
  const merged = useMemo<MapOverlay>(
    () => ({
      ...overlay,
      images: images
        .filter((i) => shown[i.id] !== false)
        .map((i) => ({ ...i, opacity: typeof shown[i.id] === "number" ? (shown[i.id] as number) : i.opacity })),
    }),
    [overlay, images, shown]
  );
  return (
    <ContourEditor
      license={license}
      licenseArea={licenseArea}
      contourSource={contourSource}
      overlay={merged}
      aside={
        <>
          <GeoAnalysisPanel license={license} others={others} overlay={overlay} onOverlay={setOverlay} />
          <MapLayersPanel licenseId={license.id} images={images} shown={shown} onShown={setShown} />
        </>
      }
    />
  );
}
