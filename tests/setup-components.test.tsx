import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { SetupWizard } from "@/components/SetupWizard";
import { createLocalGoalRepository } from "@/data/goalRepository";
import { loadTrainingProfile } from "@/data/trainingProfileRepository";

const push = vi.fn();

vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

describe("SetupWizard", () => {
  beforeEach(() => {
    window.localStorage.clear();
    push.mockReset();
  });

  it("creates the primary goal and balanced weekly schedule", () => {
    render(<SetupWizard />);

    fireEvent.change(screen.getByLabelText("What outcome matters most right now?"), {
      target: { value: "Build sustainable health" }
    });
    fireEvent.change(
      screen.getByLabelText("Injuries, schedule limits, or equipment constraints — optional"),
      { target: { value: "Protect the right knee" } }
    );
    fireEvent.click(screen.getByRole("button", { name: "Skip budget & finish" }));

    expect(createLocalGoalRepository(window.localStorage).load()[0].title).toBe(
      "Build sustainable health"
    );
    const profile = loadTrainingProfile(window.localStorage);
    expect(profile.weeklySchedule?.sun).toEqual([]);
    expect(profile.weeklySchedule?.mon).toEqual(["strength", "cardio"]);
    expect(profile.notes).toBe("Protect the right knee");
    expect(push).toHaveBeenCalledWith("/dashboard");
  });
});
