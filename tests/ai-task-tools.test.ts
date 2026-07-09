import { describe, expect, it } from "vitest";

import type { AIToolProposal, Task } from "@/domain";
import {
  applyAITaskToolProposal,
  validateDailyPlanProposalPayload,
  validateAIToolProposalInput
} from "@/domain/aiTaskTools";

const now = "2026-05-04T10:00:00.000Z";

function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: "task-1",
    title: "Existing quest",
    status: "todo",
    priority: "medium",
    tags: ["work"],
    createdAt: now,
    updatedAt: now,
    ...overrides
  };
}

function makeProposal(overrides: Partial<AIToolProposal> = {}): AIToolProposal {
  return {
    id: "proposal-1",
    toolName: "create_task",
    summary: "Create a treadmill task.",
    payload: {
      title: "Walk on the treadmill tomorrow",
      priority: "medium",
      tags: ["health"],
      plannedForDate: "2026-05-05"
    },
    status: "pending",
    createdAt: now,
    updatedAt: now,
    ...overrides
  };
}

describe("AI task tools", () => {
  it("validates supported task tool payloads", () => {
    const validation = validateAIToolProposalInput(makeProposal(), now);

    expect(validation.ok).toBe(true);
    if (validation.ok) {
      expect(validation.value.status).toBe("pending");
      expect(validation.value.payload).toMatchObject({
        title: "Walk on the treadmill tomorrow",
        tags: ["health"]
      });
    }
  });

  it("validates a save_memory proposal and rejects an incomplete one", () => {
    const ok = validateAIToolProposalInput(
      makeProposal({
        toolName: "save_memory",
        summary: "Remember the user's resume.",
        payload: { key: "resume", content: "Head AI Architect at OTR." }
      }),
      now
    );
    expect(ok.ok).toBe(true);
    if (ok.ok) {
      expect(ok.value.payload).toMatchObject({ key: "resume", content: "Head AI Architect at OTR." });
    }

    const bad = validateAIToolProposalInput(
      makeProposal({ toolName: "save_memory", summary: "x", payload: { key: "resume" } }),
      now
    );
    expect(bad.ok).toBe(false);
  });

  it("rejects unknown tool names and malformed payloads", () => {
    expect(
      validateAIToolProposalInput({
        toolName: "delete_everything",
        summary: "Bad tool",
        payload: {}
      })
    ).toMatchObject({ ok: false, message: "Tool name is not supported." });

    expect(
      validateAIToolProposalInput({
        toolName: "create_task",
        summary: "Missing title",
        payload: { tags: ["health"] }
      })
    ).toMatchObject({ ok: false, message: "Tool proposal payload is invalid." });

    // log_metric is a coach action now: proposals validate leniently (payload
    // passed through like the voice agent); the value is checked when applied.
    expect(
      validateAIToolProposalInput({
        toolName: "log_metric",
        summary: "Energy check",
        payload: { energyLevel: 9 }
      })
    ).toMatchObject({ ok: true });
  });

  it("applies create, update, complete, defer, and archive task proposals", () => {
    const created = applyAITaskToolProposal(makeProposal(), [], now);
    expect(created.ok).toBe(true);
    if (!created.ok) {
      throw new Error(created.message);
    }
    expect(created.tasks[0]).toMatchObject({
      title: "Walk on the treadmill tomorrow",
      status: "todo",
      plannedForDate: "2026-05-05"
    });

    const updated = applyAITaskToolProposal(
      makeProposal({
        toolName: "update_task",
        summary: "Update task.",
        payload: { taskId: "task-1", title: "Updated quest", priority: "high" }
      }),
      [makeTask()],
      now
    );
    expect(updated.ok && updated.tasks[0].title).toBe("Updated quest");
    expect(updated.ok && updated.tasks[0].priority).toBe("high");

    const completed = applyAITaskToolProposal(
      makeProposal({
        toolName: "complete_task",
        summary: "Complete task.",
        payload: { taskId: "task-1" }
      }),
      [makeTask()],
      now
    );
    expect(completed.ok && completed.tasks[0].status).toBe("done");

    const deferred = applyAITaskToolProposal(
      makeProposal({
        toolName: "defer_task",
        summary: "Defer task.",
        payload: { taskId: "task-1", plannedForDate: "2026-05-06" }
      }),
      [makeTask({ status: "done", completedAt: now })],
      now
    );
    expect(deferred.ok && deferred.tasks[0]).toMatchObject({
      status: "todo",
      plannedForDate: "2026-05-06",
      completedAt: undefined
    });

    const archived = applyAITaskToolProposal(
      makeProposal({
        toolName: "archive_task",
        summary: "Archive task.",
        payload: { taskId: "task-1" }
      }),
      [makeTask()],
      now
    );
    expect(archived.ok && archived.tasks[0].status).toBe("archived");
  });

  it("lets the coach set difficulty and preserves it presence-based on update", () => {
    // create_task with a difficulty carries the tier through.
    const created = applyAITaskToolProposal(
      makeProposal({
        summary: "Create a boss quest.",
        payload: { title: "Ship the launch", difficulty: "epic" }
      }),
      [],
      now
    );
    expect(created.ok && created.tasks[0].difficulty).toBe("epic");

    // An invalid difficulty is ignored, never fatal (lenient like priority).
    const lenient = applyAITaskToolProposal(
      makeProposal({
        summary: "Create with a bogus tier.",
        payload: { title: "Quest", difficulty: "legendary" }
      }),
      [],
      now
    );
    expect(lenient.ok && lenient.tasks[0].difficulty).toBeUndefined();

    // update_task WITHOUT difficulty must preserve the existing tier.
    const preserved = applyAITaskToolProposal(
      makeProposal({
        toolName: "update_task",
        summary: "Rename only.",
        payload: { taskId: "task-1", title: "Renamed quest" }
      }),
      [makeTask({ difficulty: "epic" })],
      now
    );
    expect(preserved.ok && preserved.tasks[0].title).toBe("Renamed quest");
    expect(preserved.ok && preserved.tasks[0].difficulty).toBe("epic");

    // update_task WITH difficulty sets the new tier.
    const promoted = applyAITaskToolProposal(
      makeProposal({
        toolName: "update_task",
        summary: "Promote to hard.",
        payload: { taskId: "task-1", difficulty: "hard" }
      }),
      [makeTask()],
      now
    );
    expect(promoted.ok && promoted.tasks[0].difficulty).toBe("hard");
  });

  it("validates and applies metric and journal proposals", () => {
    const metric = applyAITaskToolProposal(
      makeProposal({
        toolName: "log_metric",
        summary: "Log sleep and energy.",
        payload: {
          date: "2026-05-04",
          checkInType: "freeform",
          sleepHours: 6,
          energyLevel: 2,
          kettlebellSwingsTotal: 80,
          karateClass: true,
          distanceWalkedMiles: 1.5
        }
      }),
      [],
      now
    );

    expect(metric.ok).toBe(true);
    if (!metric.ok) {
      throw new Error(metric.message);
    }
    expect(metric.metricEntries[0]).toMatchObject({
      date: "2026-05-04",
      checkInType: "freeform",
      sleepHours: 6,
      energyLevel: 2,
      kettlebellSwingsTotal: 80,
      karateClass: true,
      distanceWalkedMiles: 1.5
    });

    const journal = applyAITaskToolProposal(
      makeProposal({
        toolName: "create_journal_entry",
        summary: "Create lesson journal entry.",
        payload: {
          date: "2026-05-04",
          type: "lesson",
          content: "Starting earlier helps me avoid rushing."
        }
      }),
      [],
      now
    );

    expect(journal.ok).toBe(true);
    if (!journal.ok) {
      throw new Error(journal.message);
    }
    expect(journal.journalEntries[0]).toMatchObject({
      date: "2026-05-04",
      type: "lesson",
      content: "Starting earlier helps me avoid rushing."
    });
  });

  it("validates and applies DailyPlan proposals with active task IDs only", () => {
    const tasks = [
      makeTask({ id: "main", title: "Ship the slice", priority: "high" }),
      makeTask({ id: "side", title: "Review dashboard" })
    ];

    expect(
      validateDailyPlanProposalPayload(
        {
          date: "2026-05-04",
          mainQuestTaskId: "missing",
          sideQuestTaskIds: [],
          rationale: "Missing task ids should not pass."
        },
        tasks
      )
    ).toBeUndefined();

    expect(
      validateDailyPlanProposalPayload(
        {
          date: "2026-05-04",
          mainQuestTaskId: "main",
          sideQuestTaskIds: ["side", "extra-1", "extra-2", "extra-3"],
          rationale: "Too many side quests should not pass."
        },
        tasks
      )
    ).toBeUndefined();

    const result = applyAITaskToolProposal(
      makeProposal({
        toolName: "propose_daily_plan",
        summary: "Plan today around the shipping slice.",
        payload: {
          date: "2026-05-04",
          mainQuestTaskId: "main",
          sideQuestTaskIds: ["side"],
          intention: "Keep the day focused.",
          rationale: "High priority work plus one review keeps workload realistic."
        }
      }),
      tasks,
      now
    );

    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error(result.message);
    }
    expect(result.dailyPlans[0]).toMatchObject({
      date: "2026-05-04",
      mainQuestTaskId: "main",
      sideQuestTaskIds: ["side"],
      intention: "Keep the day focused."
    });
  });

  it("validates and applies AI-assisted report generation proposals", () => {
    const result = applyAITaskToolProposal(
      makeProposal({
        toolName: "generate_daily_report",
        summary: "Generate an AI-assisted report.",
        payload: {
          date: "2026-05-04",
          style: "ai_assisted",
          includeLinkedInSourceMaterial: true
        }
      }),
      [makeTask({ id: "task-1", title: "Existing quest", status: "done", completedAt: now })],
      now,
      [],
      [],
      [],
      []
    );

    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error(result.message);
    }
    expect(result.dailyReports[0]).toMatchObject({
      date: "2026-05-04",
      generatedBy: "ai"
    });
    expect(result.dailyReports[0].markdownContent).toContain("Existing quest");
    expect(result.dailyReports[0].markdownContent).toContain("Metrics not logged");
  });
});
