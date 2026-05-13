import { afterEach, describe, expect, it, vi } from "vitest";

import { confirmAIToolProposal, sendAIChatRequest } from "@/client/aiApiClient";
import type { AIToolProposal } from "@/domain";

const now = "2026-05-06T12:00:00.000Z";

function htmlResponse(status = 404): Response {
  return new Response("<!doctype html><title>Not found</title>", {
    headers: {
      "content-type": "text/html"
    },
    status
  });
}

describe("aiApiClient", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("sends AI chat through the server route", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          message: "Focus on the Main Quest.",
          mode: "morning",
          usedContext: {
            openTaskCount: 1,
            recentMetricCount: 0,
            recentJournalEntryCount: 0
          }
        }),
        {
          headers: {
            "content-type": "application/json"
          },
          status: 200
        }
      )
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      sendAIChatRequest({
        appData: { tasks: [] },
        message: "What should I do?",
        mode: "morning"
      })
    ).resolves.toMatchObject({
      message: "Focus on the Main Quest."
    });
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/ai/chat",
      expect.objectContaining({
        method: "POST"
      })
    );
  });

  it("returns a clean chat error when a static host serves HTML", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(htmlResponse()));

    await expect(
      sendAIChatRequest({
        appData: {},
        message: "Help",
        mode: "general"
      })
    ).rejects.toThrow("AI coach is unavailable right now.");
  });

  it("confirms tool proposals through the server route", async () => {
    const proposal: AIToolProposal = {
      id: "proposal-1",
      toolName: "create_task",
      summary: "Create task",
      payload: {
        title: "Refine the app"
      },
      status: "pending",
      createdAt: now,
      updatedAt: now
    };
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          ok: true,
          appliedChangeSummary: "Created task: Refine the app",
          dailyPlans: [],
          dailyReports: [],
          eveningPostmortems: [],
          journalEntries: [],
          metricEntries: [],
          tasks: []
        }),
        {
          headers: {
            "content-type": "application/json"
          },
          status: 200
        }
      )
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      confirmAIToolProposal({
        dailyPlans: [],
        dailyReports: [],
        eveningPostmortems: [],
        journalEntries: [],
        metricEntries: [],
        proposal,
        tasks: []
      })
    ).resolves.toMatchObject({
      appliedChangeSummary: "Created task: Refine the app"
    });
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/ai/tools/confirm",
      expect.objectContaining({
        method: "POST"
      })
    );
  });
});
