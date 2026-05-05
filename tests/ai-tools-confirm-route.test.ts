import { describe, expect, it } from "vitest";

import { POST } from "@/app/api/ai/tools/confirm/route";

const now = "2026-05-04T10:00:00.000Z";

function task(id: string, title: string) {
  return {
    id,
    title,
    status: "todo",
    priority: "high",
    tags: ["work"],
    createdAt: now,
    updatedAt: now
  };
}

function request(body: unknown): Request {
  return new Request("http://localhost/api/ai/tools/confirm", {
    method: "POST",
    body: JSON.stringify(body),
    headers: {
      "Content-Type": "application/json"
    }
  });
}

describe("/api/ai/tools/confirm", () => {
  it("applies a validated create task proposal", async () => {
    const response = await POST(
      request({
        proposal: {
          id: "proposal-1",
          toolName: "create_task",
          summary: "Create a treadmill task.",
          payload: {
            title: "Walk on the treadmill tomorrow",
            tags: ["health"]
          },
          status: "pending",
          createdAt: now,
          updatedAt: now
        },
        tasks: []
      })
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.ok).toBe(true);
    expect(payload.appliedChangeSummary).toBe("Created task: Walk on the treadmill tomorrow");
    expect(payload.tasks[0]).toMatchObject({
      title: "Walk on the treadmill tomorrow",
      status: "todo"
    });
  });

  it("rejects malformed proposals safely", async () => {
    const response = await POST(
      request({
        proposal: {
          id: "proposal-1",
          toolName: "delete_everything",
          summary: "Bad tool",
          payload: {},
          status: "pending",
          createdAt: now,
          updatedAt: now
        },
        tasks: []
      })
    );
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload).toEqual({ error: "Tool name is not supported." });
  });

  it("applies validated metric and journal proposals", async () => {
    const metricResponse = await POST(
      request({
        proposal: {
          id: "proposal-metric",
          toolName: "log_metric",
          summary: "Log sleep and energy.",
          payload: {
            date: "2026-05-04",
            checkInType: "freeform",
            sleepHours: 6,
            energyLevel: 2
          },
          status: "pending",
          createdAt: now,
          updatedAt: now
        },
        tasks: [],
        metricEntries: [],
        journalEntries: []
      })
    );
    const metricPayload = await metricResponse.json();

    expect(metricResponse.status).toBe(200);
    expect(metricPayload.metricEntries[0]).toMatchObject({
      sleepHours: 6,
      energyLevel: 2
    });

    const journalResponse = await POST(
      request({
        proposal: {
          id: "proposal-journal",
          toolName: "create_journal_entry",
          summary: "Create lesson journal entry.",
          payload: {
            date: "2026-05-04",
            type: "lesson",
            content: "Starting earlier helps me avoid rushing."
          },
          status: "pending",
          createdAt: now,
          updatedAt: now
        },
        tasks: [],
        metricEntries: [],
        journalEntries: []
      })
    );
    const journalPayload = await journalResponse.json();

    expect(journalResponse.status).toBe(200);
    expect(journalPayload.journalEntries[0]).toMatchObject({
      type: "lesson",
      content: "Starting earlier helps me avoid rushing."
    });
  });

  it("rejects invalid health payloads without storing metrics", async () => {
    const response = await POST(
      request({
        proposal: {
          id: "proposal-invalid-health",
          toolName: "log_metric",
          summary: "Invalid energy metric.",
          payload: {
            date: "2026-05-04",
            checkInType: "freeform",
            energyLevel: 9
          },
          status: "pending",
          createdAt: now,
          updatedAt: now
        },
        tasks: [],
        metricEntries: [],
        journalEntries: []
      })
    );
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload).toEqual({ error: "Tool proposal payload is invalid." });
  });

  it("applies a confirmed DailyPlan proposal", async () => {
    const response = await POST(
      request({
        proposal: {
          id: "proposal-plan",
          toolName: "propose_daily_plan",
          summary: "Plan today around the V11 slice.",
          payload: {
            date: "2026-05-04",
            mainQuestTaskId: "main",
            sideQuestTaskIds: ["side"],
            intention: "Ship one focused AI morning slice.",
            rationale: "One main quest and one side quest keeps the workload realistic."
          },
          status: "pending",
          createdAt: now,
          updatedAt: now
        },
        dailyPlans: [
          {
            id: "plan-report",
            date: "2026-05-04",
            mainQuestTaskId: "main",
            sideQuestTaskIds: [],
            status: "planned",
            createdAt: now,
            updatedAt: now
          }
        ],
        tasks: [task("main", "Ship V11"), task("side", "Review dashboard")]
      })
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.appliedChangeSummary).toBe("Saved DailyPlan: 2026-05-04");
    expect(payload.dailyPlans[0]).toMatchObject({
      date: "2026-05-04",
      mainQuestTaskId: "main",
      sideQuestTaskIds: ["side"],
      intention: "Ship one focused AI morning slice."
    });
  });

  it("applies a confirmed AI-assisted report proposal", async () => {
    const response = await POST(
      request({
        proposal: {
          id: "proposal-report",
          toolName: "generate_daily_report",
          summary: "Generate AI-assisted report.",
          payload: {
            date: "2026-05-04",
            style: "ai_assisted",
            includeLinkedInSourceMaterial: true
          },
          status: "pending",
          createdAt: now,
          updatedAt: now
        },
        dailyPlans: [
          {
            id: "plan-report",
            date: "2026-05-04",
            mainQuestTaskId: "main",
            sideQuestTaskIds: [],
            status: "planned",
            createdAt: now,
            updatedAt: now
          }
        ],
        dailyReports: [],
        eveningPostmortems: [],
        tasks: [task("main", "Ship V12 report")]
      })
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.appliedChangeSummary).toBe("Generated ai-assisted report: 2026-05-04");
    expect(payload.dailyReports[0]).toMatchObject({
      date: "2026-05-04",
      generatedBy: "ai"
    });
    expect(payload.dailyReports[0].markdownContent).toContain("Ship V12 report");
    expect(payload.dailyReports[0].markdownContent).toContain("Metrics not logged");
  });
});
