import type { MetricEntry } from "@/domain/types";
import { latestBloodPressure, latestGlucose } from "@/domain/vitals";

/**
 * Safety-forward (NOT diagnostic) alerts derived from the most recent vitals.
 * Hypertensive-crisis and severe glucose readings are escalated prominently so
 * a dangerous value is never just a quiet label. Always paired with a
 * "not medical advice / seek care" message — never an instruction to medicate.
 */

export type VitalsAlertSeverity = "critical" | "warning";

export type VitalsAlert = {
  id: string;
  severity: VitalsAlertSeverity;
  title: string;
  message: string;
};

export function getVitalsAlerts(metrics: MetricEntry[]): VitalsAlert[] {
  const alerts: VitalsAlert[] = [];

  const bp = latestBloodPressure(metrics);
  if (bp) {
    if (bp.category === "hypertensive_crisis") {
      alerts.push({
        id: "bp-crisis",
        severity: "critical",
        title: `Blood pressure ${bp.systolic}/${bp.diastolic} — hypertensive-crisis range`,
        message:
          "A reading this high can be a medical emergency. If you have symptoms (chest pain, shortness of breath, vision changes, weakness), seek emergency care now. Otherwise contact your healthcare provider promptly. This app is not medical advice."
      });
    } else if (bp.category === "hypertension_stage_2") {
      alerts.push({
        id: "bp-stage-2",
        severity: "warning",
        title: `Blood pressure ${bp.systolic}/${bp.diastolic} is high (stage 2)`,
        message: "Consider discussing this trend with your healthcare provider."
      });
    }
  }

  const glucose = latestGlucose(metrics);
  if (glucose) {
    if (glucose.mgDl >= 250) {
      alerts.push({
        id: "glucose-very-high",
        severity: "critical",
        title: `Blood glucose ${glucose.mgDl} mg/dL is very high`,
        message:
          "Persistently high glucose can be dangerous. If you feel unwell, contact your healthcare provider. This app is not medical advice."
      });
    } else if (glucose.mgDl < 54) {
      alerts.push({
        id: "glucose-very-low",
        severity: "critical",
        title: `Blood glucose ${glucose.mgDl} mg/dL is very low`,
        message:
          "Low blood sugar can be dangerous — treat it now (fast-acting carbs) and contact your provider if it persists. Not medical advice."
      });
    } else if (glucose.mgDl < 70) {
      alerts.push({
        id: "glucose-low",
        severity: "warning",
        title: `Blood glucose ${glucose.mgDl} mg/dL is low`,
        message: "Consider a small fast-acting carb and re-check shortly."
      });
    } else if (glucose.context === "fasting" && glucose.mgDl >= 126) {
      alerts.push({
        id: "glucose-fasting-high",
        severity: "warning",
        title: `Fasting glucose ${glucose.mgDl} mg/dL is in the diabetes range`,
        message: "Worth reviewing with your healthcare provider over time."
      });
    }
  }

  return alerts;
}
