"use client";

import { useCallback, useEffect, useState } from "react";

import { playDing } from "@/client/sfx";
import { SectionHeader } from "@/components/SectionHeader";
import { dataChangedEventName } from "@/data/createLocalRepository";
import { createLocalSupplementRepository } from "@/data/supplementRepository";
import { toLocalIsoDate } from "@/domain/dates";
import {
  createSupplementLogEntry,
  isSupplementTaken,
  type SupplementLogEntry,
  type SupplementSlot
} from "@/domain/supplements";

/** Fixed name so the one-tap buttons round-trip with isSupplementTaken. */
export const QUICK_MED_NAME = "Medication";

const SLOTS: { slot: SupplementSlot; label: string; icon: string }[] = [
  { slot: "morning", label: "Morning meds", icon: "☀️" },
  { slot: "bedtime", label: "Night meds", icon: "🌙" }
];

/**
 * One tap to log (or un-log) today's morning / nighttime medication. No forms,
 * no names — just two buttons that flip to ✓ when taken.
 */
export function MedicationQuickLog() {
  const [entries, setEntries] = useState<SupplementLogEntry[]>([]);
  const today = toLocalIsoDate();

  const reload = useCallback(() => {
    setEntries(createLocalSupplementRepository(window.localStorage).load());
  }, []);

  useEffect(() => {
    reload();
    window.addEventListener(dataChangedEventName, reload);
    return () => window.removeEventListener(dataChangedEventName, reload);
  }, [reload]);

  function toggle(slot: SupplementSlot) {
    const repo = createLocalSupplementRepository(window.localStorage);
    const current = repo.load();
    if (isSupplementTaken(current, today, slot, QUICK_MED_NAME)) {
      repo.save(
        current.filter(
          (e) =>
            !(
              e.date === today &&
              e.slot === slot &&
              e.name.trim().toLowerCase() === QUICK_MED_NAME.toLowerCase()
            )
        )
      );
    } else {
      repo.save([createSupplementLogEntry({ date: today, slot, name: QUICK_MED_NAME }), ...current]);
      playDing();
    }
    setEntries(repo.load());
  }

  return (
    <section className="dashboard-section med-quick" aria-label="Medication">
      <SectionHeader eyebrow="Medication" title="Did you take your meds?" />
      <div className="med-quick-buttons">
        {SLOTS.map(({ slot, label, icon }) => {
          const taken = isSupplementTaken(entries, today, slot, QUICK_MED_NAME);
          return (
            <button
              key={slot}
              type="button"
              className={`med-quick-btn${taken ? " is-taken" : ""}`}
              aria-pressed={taken}
              onClick={() => toggle(slot)}
            >
              <span className="med-quick-icon" aria-hidden="true">
                {taken ? "✓" : icon}
              </span>
              <span className="med-quick-label">{label}</span>
              <span className="med-quick-state">{taken ? "Taken · tap to undo" : "Tap when taken"}</span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
