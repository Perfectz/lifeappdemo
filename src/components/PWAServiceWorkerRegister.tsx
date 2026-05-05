"use client";

import { useEffect } from "react";

import { basePath } from "@/config/site";

const currentCacheVersion = "lifequest-v18";

export function PWAServiceWorkerRegister() {
  useEffect(() => {
    if (!("serviceWorker" in navigator) || window.location.hostname === "") {
      return;
    }

    if ("caches" in window) {
      caches
        .keys()
        .then((cacheNames) =>
          Promise.all(
            cacheNames
              .filter(
                (cacheName) =>
                  cacheName.startsWith("lifequest-") &&
                  !cacheName.startsWith(currentCacheVersion)
              )
              .map((cacheName) => caches.delete(cacheName))
          )
        )
        .catch(() => {
          // Cache cleanup is best-effort; network-first loading still works without it.
        });
    }

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
