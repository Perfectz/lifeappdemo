import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AICoachPanel } from "@/components/AICoachPanel";
import { taskStorageKey } from "@/data/taskRepository";

const now = "2026-05-04T10:00:00.000Z";

describe("AICoachPanel", () => {
  beforeEach(() => {
    window.localStorage.clear();
    Object.defineProperty(window.navigator, "onLine", {
      configurable: true,
      value: true
    });
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("sends a chat message and renders the AI response", async () => {
    window.localStorage.setItem(
      taskStorageKey,
      JSON.stringify([
        {
          id: "task-1",
          title: "Open local quest",
          status: "todo",
          priority: "high",
          tags: ["work"],
          createdAt: now,
          updatedAt: now
        }
      ])
    );
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        message: "Start with Open local quest.",
        mode: "general",
        usedContext: {
          openTaskCount: 1,
          recentMetricCount: 0,
          recentJournalEntryCount: 0
        }
      })
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<AICoachPanel />);

    fireEvent.change(screen.getByLabelText("Message"), {
      target: { value: "What should I focus on today?" }
    });
    fireEvent.click(screen.getByRole("button", { name: "Send" }));

    await waitFor(() => {
      expect(screen.getByText("Start with Open local quest.")).toBeVisible();
    });
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/ai/chat",
      expect.objectContaining({
        method: "POST",
        body: expect.stringContaining("Open local quest")
      })
    );
    expect(screen.getByText("Open tasks used")).toBeVisible();
    expect(screen.getAllByText("1").length).toBeGreaterThan(0);
  });

  it("shows a safe error when the chat request fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        json: async () => ({ error: "AI coach is unavailable right now." })
      })
    );

    render(<AICoachPanel />);

    fireEvent.change(screen.getByLabelText("Message"), {
      target: { value: "Help" }
    });
    fireEvent.click(screen.getByRole("button", { name: "Send" }));

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent(
        "AI coach is unavailable right now."
      );
    });
  });

  it("shows the offline AI boundary and does not call chat when offline", async () => {
    Object.defineProperty(window.navigator, "onLine", {
      configurable: true,
      value: false
    });
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    render(<AICoachPanel />);
    window.dispatchEvent(new Event("offline"));

    await waitFor(() => {
      expect(screen.getByRole("status", { name: "AI Coach offline boundary" })).toBeVisible();
    });
    fireEvent.change(screen.getByLabelText("Message"), {
      target: { value: "Help while offline" }
    });
    fireEvent.click(screen.getByRole("button", { name: "Send" }));

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent("AI features require network access");
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("renders proposals, confirms one, and saves returned tasks", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          message: "I found one task proposal for review.",
          mode: "general",
          proposals: [
            {
              id: "proposal-1",
              toolName: "create_task",
              summary: "Create task: Walk on the treadmill tomorrow",
              payload: {
                title: "Walk on the treadmill tomorrow",
                tags: ["health"]
              },
              status: "pending",
              createdAt: now,
              updatedAt: now
            }
          ],
          usedContext: {
            openTaskCount: 0,
            recentMetricCount: 0,
            recentJournalEntryCount: 0
          }
        })
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          ok: true,
          appliedChangeSummary: "Created task: Walk on the treadmill tomorrow",
          tasks: [
            {
              id: "task-1",
              title: "Walk on the treadmill tomorrow",
              status: "todo",
              priority: "medium",
              tags: ["health"],
              createdAt: now,
              updatedAt: now
            }
          ]
        })
      });
    vi.stubGlobal("fetch", fetchMock);

    render(<AICoachPanel />);

    fireEvent.change(screen.getByLabelText("Message"), {
      target: { value: "Add a task to walk on the treadmill tomorrow." }
    });
    fireEvent.click(screen.getByRole("button", { name: "Send" }));

    await waitFor(() => {
      expect(screen.getByText("Create task: Walk on the treadmill tomorrow")).toBeVisible();
    });
    fireEvent.click(screen.getByRole("button", { name: "Confirm" }));

    await waitFor(() => {
      expect(
        screen.getByText("Applied change: Created task: Walk on the treadmill tomorrow")
      ).toBeVisible();
    });
    expect(JSON.parse(window.localStorage.getItem(taskStorageKey) ?? "[]")[0]).toMatchObject({
      title: "Walk on the treadmill tomorrow"
    });
  });

  it("rejects a proposal without mutating tasks", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          message: "Review this proposal.",
          proposals: [
            {
              id: "proposal-1",
              toolName: "create_task",
              summary: "Create task: Do not add this",
              payload: { title: "Do not add this" },
              status: "pending",
              createdAt: now,
              updatedAt: now
            }
          ]
        })
      })
    );

    render(<AICoachPanel />);

    fireEvent.change(screen.getByLabelText("Message"), {
      target: { value: "Add a task." }
    });
    fireEvent.click(screen.getByRole("button", { name: "Send" }));

    await waitFor(() => {
      expect(screen.getByText("Create task: Do not add this")).toBeVisible();
    });
    fireEvent.click(screen.getByRole("button", { name: "Reject" }));

    await waitFor(() => {
      expect(screen.getByText("Rejected proposal: Create task: Do not add this")).toBeVisible();
    });
    expect(JSON.parse(window.localStorage.getItem(taskStorageKey) ?? "[]")).toHaveLength(0);
  });
});
