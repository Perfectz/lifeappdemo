import { describe, expect, it } from "vitest";

import {
  createSupplementLogEntry,
  getKnownSupplements,
  isSupplementLogEntry,
  isSupplementTaken,
  validateSupplementLogInput,
  type SupplementLogEntry
} from "@/domain/supplements";

const now = "2026-06-26T07:30:00.000Z";

describe("supplements domain", () => {
  it("validates and creates an entry", () => {
    const entry = createSupplementLogEntry(
      { date: "2026-06-26", slot: "morning", name: " Metformin ER ", dose: "2 tablets" },
      now
    );
    expect(entry.name).toBe("Metformin ER");
    expect(entry.dose).toBe("2 tablets");
    expect(isSupplementLogEntry(entry)).toBe(true);
  });

  it("rejects an empty name or bad slot", () => {
    expect(validateSupplementLogInput({ date: "2026-06-26", slot: "morning", name: "  " }).ok).toBe(false);
    expect(
      validateSupplementLogInput({ date: "2026-06-26", slot: "noon" as never, name: "Vit D" }).ok
    ).toBe(false);
  });

  it("detects whether a supplement was taken for a date+slot (case-insensitive)", () => {
    const entries: SupplementLogEntry[] = [
      createSupplementLogEntry({ date: "2026-06-26", slot: "morning", name: "Metformin ER" }, now)
    ];
    expect(isSupplementTaken(entries, "2026-06-26", "morning", "metformin er")).toBe(true);
    expect(isSupplementTaken(entries, "2026-06-26", "bedtime", "Metformin ER")).toBe(false);
  });

  it("builds the quick-pick library: distinct names, newest first, last dose", () => {
    const entries: SupplementLogEntry[] = [
      createSupplementLogEntry({ date: "2026-06-25", slot: "bedtime", name: "Metformin ER", dose: "2" }, "2026-06-25T22:00:00.000Z"),
      createSupplementLogEntry({ date: "2026-06-26", slot: "morning", name: "Vitamin D", dose: "2000 IU" }, "2026-06-26T07:00:00.000Z"),
      createSupplementLogEntry({ date: "2026-06-26", slot: "morning", name: "metformin er", dose: "2 tablets" }, "2026-06-26T07:05:00.000Z")
    ];
    const known = getKnownSupplements(entries);
    expect(known.map((k) => k.name)).toEqual(["metformin er", "Vitamin D"]); // de-duped, newest first
    expect(known[0].lastDose).toBe("2 tablets"); // most recent dose for that name
  });
});
