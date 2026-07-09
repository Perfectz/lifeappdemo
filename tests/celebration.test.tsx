import { act, render, screen } from "@testing-library/react";
import React from "react";
import { describe, expect, it } from "vitest";

import {
  celebrateEventName,
  questCompletionCelebration,
  type CelebrationDetail
} from "@/client/celebrate";
import { CelebrationOverlay } from "@/components/CelebrationOverlay";

function dispatchCelebration(detail: CelebrationDetail) {
  act(() => {
    window.dispatchEvent(new CustomEvent(celebrateEventName, { detail }));
  });
}

describe("questCompletionCelebration", () => {
  it("fires the boss moment for an epic quest", () => {
    expect(
      questCompletionCelebration({ title: "Ship the launch", difficulty: "epic" })
    ).toEqual({
      kind: "boss",
      title: "BOSS QUEST CLEARED — +4 XP",
      subtitle: "Ship the launch",
      pose: "victory"
    });
  });

  it("keeps the quest kind but calls out +2 XP for a hard quest", () => {
    expect(
      questCompletionCelebration({ title: "Deep work block", difficulty: "hard" })
    ).toEqual({
      kind: "quest",
      title: "QUEST COMPLETE!",
      subtitle: "Deep work block — +2 XP",
      pose: "questComplete"
    });
  });

  it("keeps the classic moment for quick, standard, and legacy quests", () => {
    const classic = {
      kind: "quest",
      title: "QUEST COMPLETE!",
      subtitle: "Walk the dog",
      pose: "questComplete"
    };

    expect(questCompletionCelebration({ title: "Walk the dog" })).toEqual(classic);
    expect(
      questCompletionCelebration({ title: "Walk the dog", difficulty: "quick" })
    ).toEqual(classic);
    expect(
      questCompletionCelebration({ title: "Walk the dog", difficulty: "standard" })
    ).toEqual(classic);
  });
});

describe("CelebrationOverlay boss variant", () => {
  it("renders the boss card with the crown treatment", () => {
    render(<CelebrationOverlay />);

    dispatchCelebration(questCompletionCelebration({ title: "Slay Q3", difficulty: "epic" }));

    const status = screen.getByRole("status");
    expect(status.querySelector(".celebration-card-boss")).not.toBeNull();
    expect(status.querySelector(".celebration-crown")).not.toBeNull();
    expect(screen.getByText("BOSS QUEST CLEARED — +4 XP")).toBeVisible();
    expect(screen.getByText("Slay Q3")).toBeVisible();
  });

  it("keeps the crown off non-boss celebrations", () => {
    render(<CelebrationOverlay />);

    dispatchCelebration(questCompletionCelebration({ title: "Tidy inbox" }));

    const status = screen.getByRole("status");
    expect(status.querySelector(".celebration-card-quest")).not.toBeNull();
    expect(status.querySelector(".celebration-crown")).toBeNull();
  });
});
