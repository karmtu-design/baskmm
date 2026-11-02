// BASK's own line icons for the menu and the list of sections: one stroke weight, rounded ends,
// each picture says what the section is (a folded map, a certificate with a seal, a gem for projects…).
import type { SVGProps } from "react";

const make = (...paths: string[]) => {
  const Icon = (props: SVGProps<SVGSVGElement>) => (
    <svg
      viewBox="0 0 24 24"
      width="1em"
      height="1em"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      {...props}
    >
      {paths.map((d) => (
        <path key={d} d={d} />
      ))}
    </svg>
  );
  return Icon;
};

export const baskIcons = {
  navHome: make("M3 10.5 12 3l9 7.5", "M5 9v11h5v-6h4v6h5V9"),
  navMap: make("M9 4 3 6v14l6-2 6 2 6-2V4l-6 2-6-2Z", "M9 4v14", "M15 6v14"),
  navLicense: make("M3 5h18v12h-5", "M8 17H3V5", "M7 9h10", "M7 12.5h4", "M16 15.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z", "m14.5 17.5-.5 3.5 2-1 2 1-.5-3.5"),
  navCompany: make("M4 21V5.5L12 3v18", "M12 9l8 2.5V21", "M2 21h20", "M7.5 8h1.5", "M7.5 12h1.5", "M7.5 16h1.5", "M15.5 14h1.5", "M15.5 17.5h1.5"),
  navProject: make("M6.5 3.5h11L21 9l-9 11.5L3 9Z", "M3 9h18", "M9.5 3.5 8 9l4 11.5L16 9l-1.5-5.5"),
  navPresent: make("M2.5 4h19", "M4 4v11h16V4", "M12 15v3.5", "M8.5 21 12 18.5 15.5 21", "m8 11.5 3-3 2 2 3-3"),
  navTask: make("M9 3.5h6v3H9Z", "M9 5H6v16h12V5h-3", "m9 13.5 2 2 4-4"),
  navAll: make("M4 4h6.5v6.5H4Z", "M13.5 4H20v6.5h-6.5Z", "M4 13.5h6.5V20H4Z", "M13.5 13.5H20V20h-6.5Z"),
  navDocs: make("M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8.5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z"),
  navFinance: make("M2.5 6.5h19v11h-19Z", "M12 14.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z", "M6 10v4", "M18 10v4"),
  navStats: make("M4 20h16", "M7 16.5V12", "M12 16.5V7", "M17 16.5V9.5"),
  navGeo: make("M12 3 2 8l10 5 10-5Z", "m2 12.5 10 5 10-5", "m2 17 10 5 10-5"),
  navStaff: make("M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z", "M2 21a7 7 0 0 1 14 0", "M16 3.5a4 4 0 0 1 0 7.5", "M22 21a6 6 0 0 0-4-5.6"),
  navAudit: make("M3 12a9 9 0 1 0 2.6-6.4L3 8", "M3 3v5h5", "M12 7.5V12l3 2"),
  navSun: make("M12 16.5a4.5 4.5 0 1 0 0-9 4.5 4.5 0 0 0 0 9Z", "M12 2v2", "M12 20v2", "m4.9 4.9 1.4 1.4", "m17.7 17.7 1.4 1.4", "M2 12h2", "M20 12h2", "m4.9 19.1 1.4-1.4", "m17.7 6.3 1.4-1.4"),
  navMoon: make("M20.5 14.5A8.5 8.5 0 0 1 9.5 3.5a8.5 8.5 0 1 0 11 11Z"),
  navExit: make("M9.5 20.5H6a2 2 0 0 1-2-2v-13a2 2 0 0 1 2-2h3.5", "m15.5 16.5 4.5-4.5-4.5-4.5", "M20 12H9.5"),
};

declare module "@once-ui-system/core" {
  interface IconLibraryOverrides {
    navHome: true;
    navMap: true;
    navLicense: true;
    navCompany: true;
    navProject: true;
    navPresent: true;
    navTask: true;
    navAll: true;
    navDocs: true;
    navFinance: true;
    navStats: true;
    navGeo: true;
    navStaff: true;
    navAudit: true;
    navSun: true;
    navMoon: true;
    navExit: true;
  }
}
