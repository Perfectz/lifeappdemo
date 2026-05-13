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

    expect(
      validateAIToolProposalInput({
        toolName: "log_metric",
        summary: "Invalid energy metric",
        payload: { date: "2026-05-04", checkInType: "freeform", energyLevel: 9 }
      })
    ).toMatchObject({ ok: false, message: "Tool proposal payload is invalid." });
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
