import { fireEvent, render, screen } from "@testing-library/react";
import React from "react";
import { afterEach, describe, expect, it } from "vitest";

import { MedicationQuickLog, QUICK_MED_NAME } from "@/components/MedicationQuickLog";
import { createLocalSupplementRepository } from "@/data/supplementRepository";
import { isSupplementTaken } from "@/domain/supplements";
import { toLocalIsoDate } from "@/domain/dates";

describe("MedicationQuickLog", () => {
  afterEach(() => window.localStorage.clear());

  it("one tap logs the morning med; tapping again undoes it", () => {
    render(<MedicationQuickLog />);
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
    render(<MedicationQuickLog />);
    fireEvent.click(screen.getByRole("button", { name: /Night meds/ }));
    const entries = createLocalSupplementRepository(window.localStorage).load();
    const today = toLocalIsoDate();
    expect(isSupplementTaken(entries, today, "bedtime", QUICK_MED_NAME)).toBe(true);
    expect(isSupplementTaken(entries, today, "morning", QUICK_MED_NAME)).toBe(false);
  });
});
