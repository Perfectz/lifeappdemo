"use client";

import { useEffect } from "react";

import { basePath } from "@/config/site";

export function PWAServiceWorkerRegister() {
  useEffect(() => {
    if (!("serviceWorker" in navigator) || window.location.hostname === "") {
      return;
    }

    // Old-cache cleanup is owned by sw.js's `activate` handler, which prunes
    // every cache that doesn't match its CACHE_VERSION. Doing it here too with
    // a second hardcoded version string caused the live caches to be deleted
    // whenever the two versions drifted apart (which broke offline support).
    navigator.serviceWorker
      .register(`${basePath}/sw.js`, { scope: basePath ? `${basePath}/` : "/" })
      .then((registration) => {
        void registration.update();
        registration.waiting?.postMessage({ type: "SKIP_WAITING" });
      })
      .catch(() => {
        // Install guidance still renders if registration is blocked by the browser.
      });
  }, []);

  return null;
}
