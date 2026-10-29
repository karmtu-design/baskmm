import type { Metadata } from "next";
import IntroSplash from "@/components/IntroSplash";
import { INTRO_KEY } from "@/lib/brand";
import "./globals.css";

export const metadata: Metadata = {
  title: "BASK Metals and Mining",
  description: "Exploring Resources. Creating Value.",
  robots: { index: false, follow: false },
};

// Runs before the page is painted: skips the splash when it was already shown this session
// or when the visitor has asked the system to reduce motion.
const introGate = `try{if(sessionStorage.getItem(${JSON.stringify(INTRO_KEY)})||matchMedia("(prefers-reduced-motion: reduce)").matches)document.documentElement.dataset.intro="seen"}catch(e){document.documentElement.dataset.intro="seen"}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: introGate }} />
        <noscript>
          <style>{`.intro{display:none}`}</style>
        </noscript>
      </head>
      <body className="min-h-screen font-sans antialiased">
        {children}
        <IntroSplash />
      </body>
    </html>
  );
}
