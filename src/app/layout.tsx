import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Bask Metals and Mining",
  description: "Внутренняя система управления лицензиями на недропользование",
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru">
      <body className="min-h-screen font-sans antialiased">{children}</body>
    </html>
  );
}
