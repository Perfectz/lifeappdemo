import type { MetadataRoute } from "next";

import { basePath, withBasePath } from "@/config/site";

export const dynamic = "force-static";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "LifeQuest OS",
    short_name: "LifeQuest",
    description: "A local-first JRPG-inspired life operating system.",
    start_url: withBasePath(basePath ? "/dashboard/" : "/dashboard"),
    scope: basePath ? `${basePath}/` : "/",
    display: "standalone",
    display_override: ["window-controls-overlay", "standalone", "minimal-ui"],
    background_color: "#101319",
    theme_color: "#101319",
    icons: [
      {
        src: withBasePath("/icons/icon-192.png"),
        sizes: "192x192",
        type: "image/png",
        purpose: "any"
      },
      {
        src: withBasePath("/icons/icon-512.png"),
        sizes: "512x512",
        type: "image/png",
        purpose: "any"
      },
      {
        src: withBasePath("/icons/maskable-512.png"),
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable"
      },
      {
        src: withBasePath("/icons/icon-192.svg"),
        sizes: "192x192",
        type: "image/svg+xml"
      },
      {
        src: withBasePath("/icons/icon-512.svg"),
        sizes: "512x512",
        type: "image/svg+xml"
      }
    ]
  };
}
