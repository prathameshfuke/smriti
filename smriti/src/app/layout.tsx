import type { Metadata, Viewport } from "next";
import {
  Atkinson_Hyperlegible,
  Fraunces,
  Noto_Sans_Bengali,
  Noto_Sans_Devanagari,
} from "next/font/google";
import { LanguageProvider } from "@/lib/i18n/provider";
import Disclaimer from "@/components/layout/Disclaimer";
import ActivityTracker from "@/components/layout/ActivityTracker";
import AudioRouteReset from "@/components/layout/AudioRouteReset";
import DisplaySizeSync from "@/components/layout/DisplaySizeSync";
import { DEFAULT_DISPLAY_SIZE, DISPLAY_SIZE_BOOT_SCRIPT } from "@/lib/a11y/sizing";
import { ZOOM_LOCK_BOOT_SCRIPT } from "@/lib/a11y/zoomLock";
import "./globals.css";

/**
 * Atkinson Hyperlegible is the body/UI face for every screen — patient,
 * caregiver and marketing alike. It's purpose-built for low-vision readers
 * (large x-height, disambiguated l/I/1/0), which matches this cohort
 * directly. Noto Bengali and Devanagari follow as fallbacks (see
 * globals.css) because Assamese (Bengali script) and Hindi (Devanagari)
 * render as tofu without a font that covers them.
 */
const atkinsonHyperlegible = Atkinson_Hyperlegible({
  variable: "--font-smriti-atkinson",
  subsets: ["latin"],
  weight: ["400", "700"],
  display: "swap",
});

const notoSansBengali = Noto_Sans_Bengali({
  variable: "--font-smriti-bengali",
  subsets: ["bengali"],
  display: "swap",
});

const notoSansDevanagari = Noto_Sans_Devanagari({
  variable: "--font-smriti-devanagari",
  subsets: ["devanagari"],
  display: "swap",
});

/**
 * Fraunces: editorial display serif (design doc §3.2) for every heading,
 * hero, testimonial and metric app-wide — high-contrast, open counters,
 * graceful italics for the emphasis word in a headline. Variable weight +
 * italic axis, self-hosted at build time (next/font) so it works offline.
 */
const fraunces = Fraunces({
  variable: "--font-smriti-serif",
  subsets: ["latin"],
  style: ["normal", "italic"],
  weight: ["400", "500", "600"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "SMRITI - Cognitive Care",
  description:
    "Offline-first cognitive games and medication reminders for elderly dementia care in Northeast India",
  manifest: "/manifest.json",
  applicationName: "SMRITI",
  appleWebApp: { capable: true, title: "SMRITI", statusBarStyle: "default" },
  formatDetection: { telephone: false },
  icons: { apple: "/icons/apple-touch-icon.png" },
};

export const viewport: Viewport = {
  themeColor: "#B3452D",
  width: "device-width",
  initialScale: 1,
  // Zoom stays enabled: low vision is the norm in this cohort, and locking
  // scale here (maximumScale / userScalable) would fail WCAG 1.4.4 for every
  // device. Accidental zoom (double-tap from a shaky tap, mis-read pinch
  // while dragging) is instead handled in globals.css via `touch-action`:
  // double-tap-zoom is blocked unconditionally, and pinch-zoom is blocked
  // only on devices a caregiver opts into "Zoom lock" in Settings (see
  // lib/a11y/zoomLock.ts) — a per-device choice, not a global restriction.
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${atkinsonHyperlegible.variable} ${notoSansBengali.variable} ${notoSansDevanagari.variable} ${fraunces.variable} h-full antialiased`}
      data-text-size={DEFAULT_DISPLAY_SIZE}
      data-icon-size={DEFAULT_DISPLAY_SIZE}
      data-zoom-locked="false"
      // The boot scripts below rewrite these data attributes from saved
      // settings before first paint; the DOM value is the correct one.
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: DISPLAY_SIZE_BOOT_SCRIPT }} />
        <script dangerouslySetInnerHTML={{ __html: ZOOM_LOCK_BOOT_SCRIPT }} />
      </head>
      <body className="min-h-full flex flex-col bg-surface text-ink">
        <LanguageProvider>
          <ActivityTracker />
          <AudioRouteReset />
          <DisplaySizeSync />
          <div className="flex flex-1 flex-col">{children}</div>
          <Disclaimer />
        </LanguageProvider>
      </body>
    </html>
  );
}
