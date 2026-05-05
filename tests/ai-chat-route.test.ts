import { afterEach, describe, expect, it, vi } from "vitest";

import { POST } from "@/app/api/ai/chat/route";
import { setOpenAIChatCompletionForTests } from "@/server/ai/openaiClient";

function request(body: unknown): Request {
  return new Request("http://localhost/api/ai/chat", {
    method: "POST",
    body: JSON.stringify(body),
    headers: {
      "Content-Type": "application/json"
    }
  });
}

describe("/api/ai/chat", () => {
  afterEach(() => {
    setOpenAIChatCompletionForTests(undefined);
    vi.restoreAllMocks();
  });

  it("rejects invalid requests", async () => {
    const response = await POST(request({ message: "", mode: "general" }));
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload).toEqual({ error: "Message is required." });
  });

  it("calls the mocked OpenAI client with server-built context", async () => {
    const completion = vi.fn().mockResolvedValue("Focus on the main quest first.");
    setOpenAIChatCompletionForTests(completion);

    const response = await POST(
      request({
        message: "What should I focus on today?",
        mode: "general",
        appData: {
          tasks: [
            {
              id: "task-1",
              title: "Main quest from context",
              status: "todo",
              priority: "high",
              tags: ["work"],
              createdAt: "2026-05-04T10:00:00.000Z",
              updatedAt: "2026-05-04T10:00:00.000Z"
            }
          ],
          metricEntries: [
            {
              id: "metric-1",
              date: "2026-05-04",
              checkInType: "morning",
              source: "manual",
              energyLevel: 4,
              recordedAt: "2026-05-04T10:00:00.000Z",
              createdAt: "2026-05-04T10:00:00.000Z",
              updatedAt: "2026-05-04T10:00:00.000Z"
            }
          ]
        }
      })
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toEqual({
      message: "Focus on the main quest first.",
      mode: "general",
      usedContext: {
        openTaskCount: 1,
        recentMetricCount: 1,
        recentJournalEntryCount: 0
      }
    });
    expect(completion).toHaveBeenCalledWith(
      expect.objectContaining({
        message: "What should I focus on today?",
        mode: "general",
        context: expect.stringContaining("Main quest from context")
      })
    );
  });

  it("returns validated pending tool proposals from mocked AI output", async () => {
    setOpenAIChatCompletionForTests(
      vi.fn().mockResolvedValue({
        message: "I can add that after you confirm.",
        proposals: [
          {
            toolName: "create_task",
            summary: "Create task: Walk on the treadmill tomorrow",
            payload: {
              title: "Walk on the treadmill tomorrow",
              tags: ["health"]
            }
          },
          {
            toolName: "delete_everything",
            summary: "Invalid tool",
            payload: {}
          }
        ]
      })
    );

    const response = await POST(
      request({
        message: "Add a task to walk on the treadmill tomorrow.",
        mode: "general"
      })
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.message).toBe("I can add that after you confirm.");
    expect(payload.proposals).toHaveLength(1);
    expect(payload.proposals[0]).toMatchObject({
      toolName: "create_task",
      summary: "Create task: Walk on the treadmill tomorrow",
      status: "pending"
    });
  });

  it("returns validated metric and journal tool proposals", async () => {
    setOpenAIChatCompletionForTests(
      vi.fn().mockResolvedValue({
        message: "I can log those after confirmation.",
        proposals: [
          {
            toolName: "log_metric",
            summary: "Log sleep and low energy.",
            payload: {
              date: "2026-05-04",
              checkInType: "freeform",
              sleepHours: 6,
              energyLevel: 2
            }
          },
          {
            toolName: "create_journal_entry",
            summary: "Create lesson journal entry.",
            payload: {
              date: "2026-05-04",
              type: "lesson",
              content: "Starting earlier helps me avoid rushing."
            }
          }
        ]
      })
    );

    const response = await POST(
      request({
        message: "I slept 6 hours and learned starting earlier helps.",
        mode: "general"
      })
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.proposals).toHaveLength(2);
    expect(payload.proposals[0]).toMatchObject({
      toolName: "log_metric",
      payload: {
        sleepHours: 6,
        energyLevel: 2
      }
    });
    expect(payload.proposals[1]).toMatchObject({
      toolName: "create_journal_entry",
      payload: {
        type: "lesson",
        content: "Starting earlier helps me avoid rushing."
      }
    });
  });

  it("returns a validated DailyPlan proposal in morning mode", async () => {
    setOpenAIChatCompletionForTests(
      vi.fn().mockResolvedValue({
        message: "Here is a realistic plan for today.",
        proposals: [
          {
            toolName: "propose_daily_plan",
            summary: "Plan today around the main shipping slice.",
            payload: {
              date: "2026-05-04",
              mainQuestTaskId: "main",
              sideQuestTaskIds: ["side"],
              intention: "Protect focus and avoid overload.",
              rationale: "Low energy means one main quest and one side quest is enough."
            }
          }
        ]
      })
    );

    const response = await POST(
      request({
        message: "What should I prioritize today?",
        mode: "morning",
        appData: {
          tasks: [
            {
              id: "main",
              title: "Ship V11",
              status: "todo",
              priority: "high",
              tags: ["work"],
              createdAt: "2026-05-04T10:00:00.000Z",
              updatedAt: "2026-05-04T10:00:00.000Z"
            }
          ]
        }
      })
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.proposals[0]).toMatchObject({
      toolName: "propose_daily_plan",
      payload: {
        mainQuestTaskId: "main",
        sideQuestTaskIds: ["side"],
        rationale: "Low energy means one main quest and one side quest is enough."
      }
    });
  });

  it("returns a validated report proposal in evening mode", async () => {
    setOpenAIChatCompletionForTests(
      vi.fn().mockResolvedValue({
        message: "I can generate the report after confirmation.",
        proposals: [
          {
            toolName: "generate_daily_report",
            summary: "Generate AI-assisted report for today.",
            payload: {
              date: "2026-05-04",
              style: "ai_assisted",
              includeLinkedInSourceMaterial: true
            }
          }
        ]
      })
    );

    const response = await POST(
      request({
        message: "Generate tonight's report.",
        mode: "evening"
      })
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.proposals[0]).toMatchObject({
      toolName: "generate_daily_report",
      payload: {
        style: "ai_assisted",
        includeLinkedInSourceMaterial: true
      }
    });
  });

  it("returns a safe error when the AI call fails", async () => {
    setOpenAIChatCompletionForTests(vi.fn().mockRejectedValue(new Error("sk-secret leaked")));

    const response = await POST(request({ message: "Help", mode: "general" }));
    const payload = await response.json();

    expect(response.status).toBe(502);
    expect(payload).toEqual({
      error: "AI coach is unavailable right now. Try again in a moment."
    });
  });
});
