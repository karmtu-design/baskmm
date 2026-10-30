"use client";

import { DataThemeProvider, IconProvider, ThemeProvider, ToastProvider } from "@once-ui-system/core";
import { LayoutProvider } from "@once-ui-system/core/next";
import { SerwistProvider } from "@serwist/turbopack/react";
import { dataStyle, style } from "@/resources/once-ui.config";

// LayoutProvider from /next routes links and images through next/link and next/image.
export function Providers({ children }: { children: React.ReactNode }) {
  return (
    // the service worker makes the site installable as an app; off while developing locally
    <SerwistProvider swUrl="/serwist/sw.js" disable={process.env.NODE_ENV === "development"} cacheOnNavigation={false} reloadOnOnline>
      <LayoutProvider>
        <ThemeProvider {...style}>
          <DataThemeProvider {...dataStyle}>
            <ToastProvider>
              <IconProvider>{children}</IconProvider>
            </ToastProvider>
          </DataThemeProvider>
        </ThemeProvider>
      </LayoutProvider>
    </SerwistProvider>
  );
}
