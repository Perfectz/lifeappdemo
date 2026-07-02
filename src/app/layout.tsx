import type { Metadata, Viewport } from "next";
import { Pixelify_Sans, VT323 } from "next/font/google";
import type { ReactNode } from "react";

import { AppShell } from "@/components/AppShell";
import { AuthGate } from "@/components/AuthGate";
import { PWAServiceWorkerRegister } from "@/components/PWAServiceWorkerRegister";
import { withBasePath } from "@/config/site";
import "./globals.css";
import "./timeline-mirror.css";

// Display font for chrome labels (brand, group captions, nav strongs,
// hero name). Pixelify Sans is crisp at small sizes and reads like a
// late-90s JRPG menu header.
const pixelifySans = Pixelify_Sans({
  subsets: ["latin"],
  display: "swap",
  weight: ["400", "500", "600", "700"],
  variable: "--font-pixel-display"
});

// Monospaced bitmap font for status readouts and the command-palette
// prompt. VT323 is a classic terminal/early-CRT face that lands the
// PSX status-window feel.
const vt323 = VT323({
  subsets: ["latin"],
  display: "swap",
  weight: "400",
  variable: "--font-pixel-mono"
});

export const metadata: Metadata = {
  metadataBase: new URL("https://perfectz.github.io/lifeappdemo"),
  title: {
    default: "LifeQuest OS",
    template: "%s | LifeQuest OS"
  },
  description: "A local-first JRPG-inspired life operating system scaffold.",
  openGraph: {
    title: "LifeQuest OS",
    description: "A local-first JRPG-inspired life operating system scaffold.",
    type: "website"
  },
  applicationName: "LifeQuest OS",
  manifest: withBasePath("/manifest.webmanifest"),
  icons: {
    icon: [
      { url: withBasePath("/icons/icon-192.png"), sizes: "192x192", type: "image/png" },
      { url: withBasePath("/icons/icon-512.png"), sizes: "512x512", type: "image/png" }
    ],
    apple: [
      { url: withBasePath("/icons/icon-192.png"), sizes: "192x192", type: "image/png" }
    ]
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "LifeQuest"
  }
};

export const viewport: Viewport = {
  themeColor: "#101319",
  width: "device-width",
  initialScale: 1,
  // Draw under the status bar / gesture area so the existing
  // env(safe-area-inset-*) CSS actually resolves to non-zero values on
  // notched phones and installed PWAs. Without viewport-fit=cover those
  // insets are always 0.
  viewportFit: "cover"
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${pixelifySans.variable} ${vt323.variable}`}>
      <body>
        {/* Apply the stored menu theme before paint to avoid a flash of
            the default skin on first render. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('lifequest.theme.v1');if(t&&t!=='psx'){document.documentElement.setAttribute('data-theme',t);}}catch(e){}})();`
          }}
        />
        <PWAServiceWorkerRegister />
        <AuthGate>
          <AppShell>{children}</AppShell>
        </AuthGate>
      </body>
    </html>
  );
}
