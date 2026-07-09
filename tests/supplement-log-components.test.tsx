import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import React from "react";
import { beforeEach, describe, expect, it } from "vitest";

import { QUICK_MED_NAME, SupplementLog } from "@/components/SupplementLog";
import { createLocalSupplementRepository, supplementStorageKey } from "@/data/supplementRepository";
import { toLocalIsoDate } from "@/domain/dates";
import { isSupplementLogEntry, isSupplementTaken } from "@/domain/supplements";

describe("SupplementLog", () => {
  beforeEach(() => window.localStorage.clear());

  it("adds a new supplement to the morning slot and checks it off", async () => {
    render(<SupplementLog />);

    const morning = screen.getByLabelText("Morning");
    fireEvent.change(within(morning).getByPlaceholderText("Add supplement / med"), {
      target: { value: "Metformin ER" }
    });
    fireEvent.change(within(morning).getByPlaceholderText("dose (optional)"), {
      target: { value: "2 tablets" }
    });
    fireEvent.click(within(morning).getByRole("button", { name: "Add" }));

    await waitFor(() => {
      expect(within(morning).getByRole("checkbox", { name: /Metformin ER Morning/i })).toBeChecked();
    });

    const stored = JSON.parse(window.localStorage.getItem(supplementStorageKey) ?? "[]");
    expect(stored).toHaveLength(1);
    expect(stored[0]).toMatchObject({ name: "Metformin ER", slot: "morning", dose: "2 tablets" });
  });

  it("remembers an item so it can be picked in the other slot (quick re-entry)", async () => {
    render(<SupplementLog />);

    const morning = screen.getByLabelText("Morning");
    fireEvent.change(within(morning).getByPlaceholderText("Add supplement / med"), {
      target: { value: "Metformin ER" }
    });
    fireEvent.click(within(morning).getByRole("button", { name: "Add" }));

    // The remembered item now appears as a checkbox in the Bedtime slot too.
    const bedtime = screen.getByLabelText("Bedtime");
    const bedtimeCheckbox = await within(bedtime).findByRole("checkbox", { name: /Metformin ER Bedtime/i });
    expect(bedtimeCheckbox).not.toBeChecked();

    fireEvent.click(bedtimeCheckbox);
    await waitFor(() => expect(bedtimeCheckbox).toBeChecked());

    const stored = JSON.parse(window.localStorage.getItem(supplementStorageKey) ?? "[]");
    expect(stored.map((e: { slot: string }) => e.slot).sort()).toEqual(["bedtime", "morning"]);
  });

  it("unchecks (removes) a logged supplement", async () => {
    render(<SupplementLog />);
    const morning = screen.getByLabelText("Morning");
    fireEvent.change(within(morning).getByPlaceholderText("Add supplement / med"), {
      target: { value: "Vitamin D" }
    });
    fireEvent.click(within(morning).getByRole("button", { name: "Add" }));

    const checkbox = await within(morning).findByRole("checkbox", { name: /Vitamin D Morning/i });
    fireEvent.click(checkbox);
    await waitFor(() => expect(checkbox).not.toBeChecked());
    expect(JSON.parse(window.localStorage.getItem(supplementStorageKey) ?? "[]")).toHaveLength(0);
  });

  describe("quick-tap meds row (absorbed from MedicationQuickLog)", () => {
    it("one tap logs the morning med; tapping again undoes it", () => {
      render(<SupplementLog />);
      const today = toLocalIsoDate();

      const morning = screen.getByRole("button", { name: /Morning meds/ });
      expect(morning).toHaveAttribute("aria-pressed", "false");

      fireEvent.click(morning);
      expect(
        isSupplementTaken(
          createLocalSupplementRepository(window.localStorage).load(),
          today,
          "morning",
          QUICK_MED_NAME
        )
      ).toBe(true);
      expect(screen.getByRole("button", { name: /Morning meds/ })).toHaveAttribute(
        "aria-pressed",
        "true"
      );

      // undo
      fireEvent.click(screen.getByRole("button", { name: /Morning meds/ }));
      expect(
        isSupplementTaken(
          createLocalSupplementRepository(window.localStorage).load(),
          today,
          "morning",
          QUICK_MED_NAME
        )
      ).toBe(false);
    });

    it("morning and night are independent", () => {
      render(<SupplementLog />);
      fireEvent.click(screen.getByRole("button", { name: /Night meds/ }));
      const entries = createLocalSupplementRepository(window.localStorage).load();
      const today = toLocalIsoDate();
      expect(isSupplementTaken(entries, today, "bedtime", QUICK_MED_NAME)).toBe(true);
      expect(isSupplementTaken(entries, today, "morning", QUICK_MED_NAME)).toBe(false);
    });

    it("writes the same entry shape the detailed checklist reads", async () => {
      render(<SupplementLog />);
      const today = toLocalIsoDate();

      fireEvent.click(screen.getByRole("button", { name: /Morning meds/ }));

      const stored = JSON.parse(window.localStorage.getItem(supplementStorageKey) ?? "[]");
      expect(stored).toHaveLength(1);
      expect(stored[0]).toMatchObject({ name: QUICK_MED_NAME, slot: "morning", date: today });
      expect(isSupplementLogEntry(stored[0])).toBe(true);

      // The detailed checklist reads the quick-tap entry: "Medication" shows
      // up as a checked item in the Morning slot.
      const morningSlot = screen.getByLabelText("Morning");
      await waitFor(() => {
        expect(
          within(morningSlot).getByRole("checkbox", { name: /Medication Morning/i })
        ).toBeChecked();
      });
    });
  });
});
