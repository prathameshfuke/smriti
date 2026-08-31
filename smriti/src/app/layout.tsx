import type { Metadata, Viewport } from "next";
import { Noto_Sans, Noto_Sans_Bengali, Noto_Sans_Devanagari } from "next/font/google";
import "./globals.css";

/**
 * SMRITI ships Assamese (Bengali script) and Hindi (Devanagari) alongside
 * English, so the font stack must cover all three. A Latin-only face renders
 * those locales as tofu.
 */
const notoSans = Noto_Sans({
  variable: "--font-smriti-latin",
  subsets: ["latin"],
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

export const metadata: Metadata = {
  title: "SMRITI - Cognitive Care",
  description:
    "AI-powered cognitive gaming for elderly dementia care in Northeast India",
  manifest: "/manifest.json",
  appleWebApp: { capable: true, title: "SMRITI", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  themeColor: "#8B6914",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${notoSans.variable} ${notoSansBengali.variable} ${notoSansDevanagari.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
