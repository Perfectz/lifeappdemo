"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { playDing } from "@/client/sfx";
import { SectionHeader } from "@/components/SectionHeader";
import { dataChangedEventName } from "@/data/createLocalRepository";
import { createLocalSupplementRepository } from "@/data/supplementRepository";
import { toLocalIsoDate } from "@/domain/dates";
import {
  createSupplementLogEntry,
  getKnownSupplements,
  isSupplementTaken,
  supplementSlotLabel,
  supplementSlots,
  type SupplementLogEntry,
  type SupplementSlot
} from "@/domain/supplements";

const DATALIST_ID = "supplement-known-names";

export function SupplementLog() {
  const [entries, setEntries] = useState<SupplementLogEntry[]>([]);
  const [drafts, setDrafts] = useState<Record<SupplementSlot, { name: string; dose: string }>>({
    morning: { name: "", dose: "" },
    bedtime: { name: "", dose: "" }
  });
  const today = toLocalIsoDate();

  const reload = useCallback(() => {
    setEntries(createLocalSupplementRepository(window.localStorage).load());
  }, []);

  useEffect(() => {
    reload();
    window.addEventListener(dataChangedEventName, reload);
    return () => window.removeEventListener(dataChangedEventName, reload);
  }, [reload]);

  const known = useMemo(() => getKnownSupplements(entries), [entries]);

  function toggle(slot: SupplementSlot, name: string, dose?: string) {
    const repo = createLocalSupplementRepository(window.localStorage);
    const all = repo.load();
    const match = all.find(
      (entry) =>
        entry.date === today &&
        entry.slot === slot &&
        entry.name.trim().toLowerCase() === name.trim().toLowerCase()
    );
    if (match) {
      repo.save(all.filter((entry) => entry.id !== match.id));
    } else {
      repo.save([createSupplementLogEntry({ date: today, slot, name, dose }), ...all]);
      playDing();
    }
    setEntries(repo.load());
  }

  function addNew(slot: SupplementSlot) {
    const draft = drafts[slot];
    const name = draft.name.trim();
    if (!name) return;
    if (!isSupplementTaken(entries, today, slot, name)) {
      toggle(slot, name, draft.dose.trim() || undefined);
    }
    setDrafts((prev) => ({ ...prev, [slot]: { name: "", dose: "" } }));
  }

  return (
    <section className="dashboard-section supplement-log" aria-label="Supplements and medication">
      <SectionHeader eyebrow="Daily routine" title="Supplements & medication" />
      <p className="reminders-help">
        Check off what you took. New items are remembered — pick them from the list next time.
      </p>

      <datalist id={DATALIST_ID}>
        {known.map((item) => (
          <option key={item.name} value={item.name} />
        ))}
      </datalist>

      <div className="supplement-slots">
        {supplementSlots.map((slot) => (
          <div className="supplement-slot" key={slot} aria-label={supplementSlotLabel[slot]}>
            <h3 className="supplement-slot-title">{supplementSlotLabel[slot]}</h3>

            {known.length > 0 ? (
              <ul className="supplement-checklist">
                {known.map((item) => {
                  const taken = isSupplementTaken(entries, today, slot, item.name);
                  return (
                    <li key={item.name}>
                      <label className={taken ? "supplement-item supplement-item-taken" : "supplement-item"}>
                        <input
                          type="checkbox"
                          checked={taken}
                          onChange={() => toggle(slot, item.name, item.lastDose)}
                          aria-label={`${item.name} ${supplementSlotLabel[slot]}`}
                        />
                        <span className="supplement-name">{item.name}</span>
                        {item.lastDose ? <span className="supplement-dose">{item.lastDose}</span> : null}
                      </label>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="reminders-help">Nothing yet — add your first below.</p>
            )}

            <div className="supplement-add">
              <input
                className="fitness-input"
                list={DATALIST_ID}
                placeholder="Add supplement / med"
                aria-label={`Add ${supplementSlotLabel[slot]} supplement`}
                value={drafts[slot].name}
                onChange={(event) =>
                  setDrafts((prev) => ({ ...prev, [slot]: { ...prev[slot], name: event.target.value } }))
                }
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    addNew(slot);
                  }
                }}
              />
              <input
                className="fitness-input supplement-dose-input"
                placeholder="dose (optional)"
                aria-label={`${supplementSlotLabel[slot]} dose`}
                value={drafts[slot].dose}
                onChange={(event) =>
                  setDrafts((prev) => ({ ...prev, [slot]: { ...prev[slot], dose: event.target.value } }))
                }
              />
              <button
                type="button"
                className="nutri-mini-btn"
                onClick={() => addNew(slot)}
                disabled={!drafts[slot].name.trim()}
              >
                Add
              </button>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
