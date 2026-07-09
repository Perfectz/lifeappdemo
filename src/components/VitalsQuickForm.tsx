"use client";

import { useState } from "react";

import { playDing } from "@/client/sfx";
import { createLocalMetricRepository } from "@/data/metricRepository";
import { glucoseContexts } from "@/domain/biometrics";
import { toLocalIsoDate } from "@/domain/dates";
import { createMetricEntry, type MetricInput } from "@/domain/metrics";
import type { GlucoseContext, MetricEntry } from "@/domain";

export type VitalsCheckInType = "freeform" | "morning";

export type VitalsQuickFormProps = {
  /**
   * Written verbatim to MetricEntry.checkInType — "freeform" from /vitals,
   * "morning" from the morning standup.
   */
  checkInType: VitalsCheckInType;
  /** Called with the saved entry after a successful write. */
  onSaved?: (entry: MetricEntry) => void;
};

/**
 * Per-surface presentation defaults. The stored entry shape is identical for
 * both surfaces — only checkInType, the notes string, and chrome differ, and
 * these values match what Vitals / MorningStandup wrote before the forms were
 * consolidated here.
 */
const surfaceConfig: Record<
  VitalsCheckInType,
  {
    notes: string;
    successText: string;
    defaultGlucoseContext: string;
    /** Freeform offers a "—" (no context) choice; morning defaults to fasting. */
    allowEmptyGlucoseContext: boolean;
    dingOnSave: boolean;
  }
> = {
  freeform: {
    notes: "Daily vitals",
    successText: "Logged today's vitals.",
    defaultGlucoseContext: "",
    allowEmptyGlucoseContext: true,
    dingOnSave: true
  },
  morning: {
    notes: "Morning vitals",
    successText: "Morning vitals logged.",
    defaultGlucoseContext: "fasting",
    allowEmptyGlucoseContext: false,
    dingOnSave: false
  }
};

function num(value: string): number | undefined {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

/**
 * The single glucose / blood pressure / weight capture form, shared by the
 * /vitals page and the morning standup so validation and the written
 * MetricEntry stay identical across surfaces.
 */
export function VitalsQuickForm({ checkInType, onSaved }: VitalsQuickFormProps) {
  const config = surfaceConfig[checkInType];
  const [glucose, setGlucose] = useState("");
  const [glucoseContext, setGlucoseContext] = useState(config.defaultGlucoseContext);
  const [systolic, setSystolic] = useState("");
  const [diastolic, setDiastolic] = useState("");
  const [weight, setWeight] = useState("");
  const [status, setStatus] = useState<{ tone: "ok" | "error"; text: string } | null>(null);

  function logVitals() {
    const glucoseMg = num(glucose);
    const sys = num(systolic);
    const dia = num(diastolic);
    const w = num(weight);

    if (!w && !sys && !dia && !glucoseMg) {
      setStatus({ tone: "error", text: "Enter a glucose, blood pressure, or weight value." });
      return;
    }
    if ((sys && !dia) || (dia && !sys)) {
      setStatus({ tone: "error", text: "Enter both systolic and diastolic." });
      return;
    }

    const input: MetricInput = {
      date: toLocalIsoDate(new Date()),
      checkInType,
      bloodGlucoseMgDl: glucoseMg,
      glucoseContext:
        glucoseMg && glucoseContexts.includes(glucoseContext as GlucoseContext)
          ? (glucoseContext as GlucoseContext)
          : undefined,
      bloodPressureSystolic: sys ? Math.round(sys) : undefined,
      bloodPressureDiastolic: dia ? Math.round(dia) : undefined,
      weightLbs: w,
      notes: config.notes
    };

    try {
      const entry = createMetricEntry(input);
      const repo = createLocalMetricRepository(window.localStorage);
      repo.save([entry, ...repo.load()]);
      setGlucose("");
      setGlucoseContext(config.defaultGlucoseContext);
      setSystolic("");
      setDiastolic("");
      setWeight("");
      setStatus({ tone: "ok", text: config.successText });
      if (config.dingOnSave) playDing();
      onSaved?.(entry);
    } catch (error) {
      setStatus({
        tone: "error",
        text: error instanceof Error ? error.message : "Couldn't save vitals."
      });
    }
  }

  return (
    <div className="vitals-form">
      <div className="vitals-bp-inputs">
        <label className="fitness-label">
          Glucose (mg/dL)
          <input
            type="number"
            inputMode="numeric"
            min={1}
            className="fitness-input"
            placeholder="e.g. 95"
            value={glucose}
            onChange={(event) => setGlucose(event.target.value)}
          />
        </label>
        <label className="fitness-label">
          When
          <select
            className="fitness-input"
            value={glucoseContext}
            onChange={(event) => setGlucoseContext(event.target.value)}
          >
            {config.allowEmptyGlucoseContext ? <option value="">—</option> : null}
            {glucoseContexts.map((context) => (
              <option key={context} value={context}>
                {context.replace(/_/g, " ")}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="vitals-bp-inputs">
        <label className="fitness-label">
          Systolic
          <input
            type="number"
            inputMode="numeric"
            min={1}
            className="fitness-input"
            placeholder="e.g. 122"
            value={systolic}
            onChange={(event) => setSystolic(event.target.value)}
          />
        </label>
        <span className="vitals-slash" aria-hidden="true">
          /
        </span>
        <label className="fitness-label">
          Diastolic
          <input
            type="number"
            inputMode="numeric"
            min={1}
            className="fitness-input"
            placeholder="e.g. 78"
            value={diastolic}
            onChange={(event) => setDiastolic(event.target.value)}
          />
        </label>
      </div>
      <label className="fitness-label">
        Weight (lb)
        <input
          type="number"
          inputMode="decimal"
          min={1}
          step="0.1"
          className="fitness-input"
          placeholder="e.g. 184.5"
          value={weight}
          onChange={(event) => setWeight(event.target.value)}
        />
      </label>
      <button type="button" className="login-submit" onClick={logVitals}>
        <span>Log vitals</span>
      </button>
      {status ? (
        <p
          className={status.tone === "error" ? "data-backup-status form-error" : "data-backup-status"}
          role={status.tone === "error" ? "alert" : "status"}
        >
          {status.text}
        </p>
      ) : null}
    </div>
  );
}
