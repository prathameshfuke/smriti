import type { Metadata, Viewport } from "next";
import { Lora, Noto_Sans_Bengali, Noto_Sans_Devanagari } from "next/font/google";
import { LanguageProvider } from "@/lib/i18n/provider";
import Disclaimer from "@/components/layout/Disclaimer";
import "./globals.css";

/**
 * Only the Indic faces are loaded. Latin comes from the system stack (see
 * globals.css) — it is already on the device and costs nothing on 2G — but
 * Assamese (Bengali script) and Hindi (Devanagari) render as tofu without a
 * font that covers them.
 */
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

/** Serif display face for the marketing/login pages' headlines only. */
const lora = Lora({
  variable: "--font-smriti-serif",
  subsets: ["latin"],
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
  icons: { apple: "/icons/icon-192.png" },
};

export const viewport: Viewport = {
  themeColor: "#8B6914",
  width: "device-width",
  initialScale: 1,
  // Zoom stays enabled: low vision is the norm in this cohort, and locking
  // scale would fail WCAG 1.4.4.
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${notoSansBengali.variable} ${notoSansDevanagari.variable} ${lora.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-surface text-ink">
        <LanguageProvider>
          <div className="flex flex-1 flex-col">{children}</div>
          <Disclaimer />
        </LanguageProvider>
      </body>
    </html>
  );
}
