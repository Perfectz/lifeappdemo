"use client";

import { useCallback, useEffect, useState } from "react";

import { dataChangedEventName } from "@/data/createLocalRepository";
import { createLocalMetricRepository } from "@/data/metricRepository";
import { getVitalsAlerts, type VitalsAlert } from "@/domain/vitalsAlerts";

/**
 * Shows safety-forward alerts for the latest vitals (e.g. hypertensive-crisis
 * blood pressure, severe glucose). Self-loading so it can drop onto any screen.
 */
export function VitalsAlertBanner() {
  const [alerts, setAlerts] = useState<VitalsAlert[]>([]);

  const reload = useCallback(() => {
    setAlerts(getVitalsAlerts(createLocalMetricRepository(window.localStorage).load()));
  }, []);

  useEffect(() => {
    reload();
    window.addEventListener(dataChangedEventName, reload);
    return () => window.removeEventListener(dataChangedEventName, reload);
  }, [reload]);

  if (alerts.length === 0) {
    return null;
  }

  return (
    <div className="vitals-alerts" role="alert" aria-label="Health alerts">
      {alerts.map((alert) => (
        <div key={alert.id} className={`vitals-alert vitals-alert-${alert.severity}`}>
          <span className="vitals-alert-icon" aria-hidden="true">
            {alert.severity === "critical" ? "🚨" : "⚠️"}
          </span>
          <div>
            <strong>{alert.title}</strong>
            <p>{alert.message}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
