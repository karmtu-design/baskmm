import "@once-ui-system/core/css/styles.css";
import "@once-ui-system/core/css/tokens.css";
import "./globals.css";

import type { Metadata, Viewport } from "next";
import { ThemeInit } from "@once-ui-system/core";
import IntroSplash from "@/components/IntroSplash";
import { Providers } from "@/components/Providers";
import { INTRO_KEY } from "@/lib/brand";
import { dataStyle, style } from "@/resources/once-ui.config";

export const metadata: Metadata = {
  title: { default: "BASK Metals and Mining", template: "%s · BASK Metals and Mining" },
  description: "Exploring Resources. Creating Value.",
  robots: { index: false, follow: false },
};

// lets the phone menu sit above the home indicator
export const viewport: Viewport = { width: "device-width", initialScale: 1, viewportFit: "cover" };

// Runs before the page is painted: skips the splash when it was already shown this session
// or when the visitor has asked the system to reduce motion.
const introGate = `try{if(sessionStorage.getItem(${JSON.stringify(INTRO_KEY)})||matchMedia("(prefers-reduced-motion: reduce)").matches)document.documentElement.dataset.intro="seen"}catch(e){document.documentElement.dataset.intro="seen"}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru" suppressHydrationWarning>
      <head>
        {/* sets the light or dark theme and BASK colours before the first paint */}
        <ThemeInit config={style} dataStyle={dataStyle} />
        <script dangerouslySetInnerHTML={{ __html: introGate }} />
        <noscript>
          <style>{`.intro{display:none}`}</style>
        </noscript>
      </head>
      <body>
        <Providers>
          {children}
          <IntroSplash />
        </Providers>
      </body>
    </html>
  );
}
