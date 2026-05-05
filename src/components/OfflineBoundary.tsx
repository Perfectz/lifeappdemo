"use client";

import { useEffect, useState } from "react";

export const aiNetworkRequiredMessage =
  "AI features require network access. Your local tasks, metrics, journal, reports, and app shell can still be reviewed offline.";

export function useNetworkStatus(): boolean {
  const [isOnline, setIsOnline] = useState(true);

  useEffect(() => {
    function updateStatus() {
      setIsOnline(navigator.onLine);
    }

    window.addEventListener("online", updateStatus);
    window.addEventListener("offline", updateStatus);

    return () => {
      window.removeEventListener("online", updateStatus);
      window.removeEventListener("offline", updateStatus);
    };
  }, []);

  return isOnline;
}

type OfflineBoundaryProps = {
  featureName?: string;
};

export function OfflineBoundary({ featureName = "AI" }: OfflineBoundaryProps) {
  return (
    <aside className="offline-boundary" role="status" aria-label={`${featureName} offline boundary`}>
      <strong>{featureName} needs the network</strong>
      <p>{aiNetworkRequiredMessage}</p>
    </aside>
  );
}
