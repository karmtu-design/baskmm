"use client";

import { useState } from "react";
import ContourEditor from "./ContourEditor";
import GeoAnalysisPanel from "./GeoAnalysisPanel";
import type { MapLicense, MapOverlay } from "./LicensesMap";
import type { Contour } from "@/lib/types";

type Lic = { id: number; deposit_name: string | null; license_number: string; company_name: string; contour: Contour | null };

/** The «Карта и контур» tab: the contour editor and the geo-analysis that draws on the same map. */
export default function LicenseMapTab({
  license,
  licenseArea,
  contourSource,
  others,
}: {
  license: MapLicense;
  licenseArea: number | null;
  contourSource: string | null;
  others: Lic[];
}) {
  const [overlay, setOverlay] = useState<MapOverlay>({});
  return (
    <ContourEditor
      license={license}
      licenseArea={licenseArea}
      contourSource={contourSource}
      overlay={overlay}
      aside={<GeoAnalysisPanel license={license} others={others} overlay={overlay} onOverlay={setOverlay} />}
    />
  );
}
