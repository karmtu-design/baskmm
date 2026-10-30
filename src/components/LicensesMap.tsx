"use client";

import { tr } from "@/i18n";

import dynamic from "next/dynamic";

// The map library needs the browser window, so it is loaded only in the browser.
const LicensesMap = dynamic(() => import("./LicensesMapInner"), {
  ssr: false,
  loading: () => (
    <div style={{ height: 420, display: "grid", placeItems: "center", borderRadius: "var(--radius-l)", border: "1px solid var(--neutral-alpha-medium)", color: "var(--neutral-on-background-weak)", fontSize: 14 }}>{tr("Загружается карта…")}</div>
  ),
});

export default LicensesMap;
export type { MapLicense, MapOverlay } from "./LicensesMapInner";
