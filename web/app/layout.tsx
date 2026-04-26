import type { Metadata, Viewport } from "next";
import { Heebo, Rubik } from "next/font/google";

import "./globals.css";

const heebo = Heebo({
  subsets: ["hebrew", "latin"],
  weight: ["400", "500", "700", "800"],
  variable: "--font-heebo",
  display: "swap",
});

const rubik = Rubik({
  subsets: ["hebrew", "latin"],
  weight: ["400", "500", "700"],
  variable: "--font-rubik",
  display: "swap",
});

// Next.js metadata does NOT auto-prepend basePath to manifest/icon URLs, so we
// stitch it in ourselves. NEXT_PUBLIC_BASE_PATH is injected by next.config.js.
const BASE = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

export const metadata: Metadata = {
  title: "מדבקות של תמר",
  description: "תגידי מה את רוצה — ונדפיס לך מדבקה",
  manifest: `${BASE}/manifest.json`,
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "מדבקות",
  },
  icons: {
    icon: `${BASE}/icon-192.png`,
    apple: `${BASE}/apple-touch-icon.png`,
  },
};

export const viewport: Viewport = {
  themeColor: "#FF6B6B",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="he" dir="rtl" className={`${heebo.variable} ${rubik.variable}`}>
      <body className="font-heebo bg-cream text-ink antialiased no-select">
        {children}
      </body>
    </html>
  );
}
