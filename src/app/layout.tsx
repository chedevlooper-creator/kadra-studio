import type { Metadata, Viewport } from "next";
import { Big_Shoulders, Figtree } from "next/font/google";
import "./globals.css";
import "./workspace.css";

// A condensed marquee face for titles and timecodes; a plain, legible sans for everything else.
// next/font has no metrics to build an automatic fallback for Big Shoulders, so the fallback is named here.
const display = Big_Shoulders({ subsets: ["latin", "latin-ext"], variable: "--font-display", display: "swap", adjustFontFallback: false, fallback: ["Arial Narrow", "sans-serif"] });
const text = Figtree({ subsets: ["latin", "latin-ext"], variable: "--font-text", display: "swap" });

export const metadata: Metadata = {
  title: "Kadra — Hikâyene hareket kat",
  description: "Senaryodan storyboard'a, ilk fikirden son kareye. Kişisel yapay zekâ film stüdyon.",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#101112" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="tr" className={`${display.variable} ${text.variable}`}><body>{children}</body></html>;
}
