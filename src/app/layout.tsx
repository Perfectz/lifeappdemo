import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";

import { AppShell } from "@/components/AppShell";
import { PWAServiceWorkerRegister } from "@/components/PWAServiceWorkerRegister";
import { withBasePath } from "@/config/site";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "LifeQuest OS",
    template: "%s | LifeQuest OS"
  },
  description: "A local-first JRPG-inspired life operating system scaffold.",
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
  themeColor: "#101319"
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <PWAServiceWorkerRegister />
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
