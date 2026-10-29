"use client";

import dynamic from "next/dynamic";

// The map library needs the browser window, so it is loaded only in the browser.
const LicensesMap = dynamic(() => import("./LicensesMapInner"), {
  ssr: false,
  loading: () => (
    <div className="grid h-[420px] place-items-center rounded-lg border border-line bg-surface text-sm text-muted">
      Загружается карта…
    </div>
  ),
});

export default LicensesMap;
export type { MapLicense } from "./LicensesMapInner";
