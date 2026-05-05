"use client";

import { useEffect, useState } from "react";

type ReadinessState = {
  canUseServiceWorker: boolean;
  hasManifest: boolean;
  isStandalone: boolean;
  isOnline: boolean;
};

export function InstallReadinessPanel() {
  const [readiness, setReadiness] = useState<ReadinessState>({
    canUseServiceWorker: false,
    hasManifest: false,
    isStandalone: false,
    isOnline: true
  });

  useEffect(() => {
    function updateReadiness() {
      const manifestLink = document.querySelector('link[rel="manifest"]');
      const displayMode = window.matchMedia("(display-mode: standalone)").matches;
      const iosStandalone =
        "standalone" in navigator && (navigator as Navigator & { standalone?: boolean }).standalone;

      setReadiness({
        canUseServiceWorker: "serviceWorker" in navigator,
        hasManifest: Boolean(manifestLink),
        isStandalone: displayMode || Boolean(iosStandalone),
        isOnline: navigator.onLine
      });
    }

    updateReadiness();
    window.addEventListener("online", updateReadiness);
    window.addEventListener("offline", updateReadiness);

    return () => {
      window.removeEventListener("online", updateReadiness);
      window.removeEventListener("offline", updateReadiness);
    };
  }, []);

  return (
    <section className="install-readiness" aria-label="PWA install readiness">
      <article>
        <strong>Manifest</strong>
        <span>{readiness.hasManifest ? "Ready" : "Not detected"}</span>
      </article>
      <article>
        <strong>Service worker</strong>
        <span>{readiness.canUseServiceWorker ? "Supported" : "Unsupported"}</span>
      </article>
      <article>
        <strong>Display mode</strong>
        <span>{readiness.isStandalone ? "Installed" : "Browser tab"}</span>
      </article>
      <article>
        <strong>Network</strong>
        <span>{readiness.isOnline ? "Online" : "Offline shell active"}</span>
      </article>
    </section>
  );
}
