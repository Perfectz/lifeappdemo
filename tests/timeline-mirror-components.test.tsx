import { fireEvent, render, screen } from "@testing-library/react";
import React from "react";
import { afterEach, describe, expect, it } from "vitest";

import { TimelineHistory } from "@/components/TimelineHistory";
import { TimelineResultCard } from "@/components/TimelineResultCard";
import type { TimelineCheckin, TimelineMirrorResult } from "@/domain/timelineMirror";

function makeResult(overrides: Partial<TimelineMirrorResult> = {}): TimelineMirrorResult {
  return {
    timelineScore: 64,
    idealPercent: 64,
    warningPercent: 36,
    direction: "toward_ideal",
    backslideDetected: false,
    confidence: "medium",
    photoTypeDetected: "face_upper_45",
    photoUsability: {
      usable: true,
      qualityScore: 78,
      issues: [],
      retakeRecommended: false,
      retakeReason: null
    },
    visualSummary: "Stronger presence than the warning reference.",
    dataSummary: "Engaged this week.",
    overallRead: "Act 1 hero training, not final boss physique yet.",
    positiveSignal: "You are still showing up.",
    warningSignal: "Watch the logs.",
    nextQuest: {
      title: "20-Minute Walk + Protein Anchor",
      description: "Walk 20 minutes, make the next meal protein-first.",
      difficulty: "easy",
      xpReward: 35,
      category: "movement"
    },
    jrpgMessage: "Patrick 2.0 remains unlocked.",
    coachNote: "One clean action proves the better timeline is active.",
    ...overrides
  };
}

describe("TimelineResultCard", () => {
  it("renders the meter, score split, quest, and JRPG message", () => {
    render(<TimelineResultCard result={makeResult()} />);
    expect(screen.getByText(/64% Ideal/)).toBeInTheDocument();
    expect(screen.getByText(/36% Warning/)).toBeInTheDocument();
    expect(screen.getByText(/20-Minute Walk \+ Protein Anchor/)).toBeInTheDocument();
    expect(screen.getByText(/\+35 XP/)).toBeInTheDocument();
    expect(screen.getByText(/Patrick 2.0 remains unlocked/)).toBeInTheDocument();
    expect(screen.getByText(/Act 1 hero training/)).toBeInTheDocument();
  });

  it("shows a backslide alert when flagged", () => {
    render(
      <TimelineResultCard
        result={makeResult({
          backslideDetected: true,
          direction: "toward_warning",
          warningSignal: "Shadow Patrick is gaining XP."
        })}
      />
    );
    expect(screen.getByRole("alert")).toHaveTextContent(/Shadow Patrick is gaining XP/);
  });

  it("surfaces a retake suggestion for low-quality photos", () => {
    render(
      <TimelineResultCard
        result={makeResult({
          photoUsability: {
            usable: true,
            qualityScore: 40,
            issues: ["Office lighting is harsh"],
            retakeRecommended: true,
            retakeReason: null
          }
        })}
      />
    );
    expect(screen.getByText(/Retake suggested/)).toBeInTheDocument();
  });

  it("renders the comparison node passed under the meter", () => {
    render(
      <TimelineResultCard
        result={makeResult()}
        comparison={<div data-testid="cmp">You vs Ideal vs Warning</div>}
      />
    );
    expect(screen.getByTestId("cmp")).toHaveTextContent("You vs Ideal vs Warning");
  });

  it("accepts the next quest into the Quest Log", () => {
    window.localStorage.clear();
    render(<TimelineResultCard result={makeResult()} />);
    const btn = screen.getByRole("button", { name: /Accept quest/ });
    fireEvent.click(btn);
    expect(screen.getByRole("button", { name: /Added to Quest Log/ })).toBeInTheDocument();
    const tasks = JSON.parse(window.localStorage.getItem("lifequest.tasks.v1") || "[]");
    expect(tasks[0].title).toMatch(/20-Minute Walk/);
    window.localStorage.clear();
  });
});

function makeCheckin(overrides: Partial<TimelineCheckin> = {}): TimelineCheckin {
  return {
    id: "c1",
    date: "2026-06-28",
    detectedPoseType: "front_full_body",
    result: makeResult(),
    createdAt: "2026-06-28T12:00:00.000Z",
    ...overrides
  };
}

describe("TimelineHistory", () => {
  afterEach(() => window.localStorage.clear());

  it("shows an empty state with no check-ins", () => {
    render(<TimelineHistory checkins={[]} onChange={() => {}} />);
    expect(screen.getByText(/No check-ins yet/)).toBeInTheDocument();
  });

  it("expands an entry to reveal the full reading on click", () => {
    render(<TimelineHistory checkins={[makeCheckin()]} onChange={() => {}} />);
    // Collapsed: the next-quest detail isn't shown yet.
    expect(screen.queryByText(/20-Minute Walk \+ Protein Anchor/)).not.toBeInTheDocument();
    // The toggle button carries the date.
    fireEvent.click(screen.getByRole("button", { expanded: false }));
    expect(screen.getByText(/20-Minute Walk \+ Protein Anchor/)).toBeInTheDocument();
  });
});
