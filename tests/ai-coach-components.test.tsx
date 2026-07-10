import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AICoachPanel } from "@/components/AICoachPanel";
import { taskStorageKey } from "@/data/taskRepository";
import { foodEntryStorageKey } from "@/data/foodEntryRepository";

const now = "2026-05-04T10:00:00.000Z";

/** Response-like stub exposing headers/json/text so it satisfies fetch
 *  wrappers that read the body through either method. */
function jsonResponse(body: unknown, ok = true) {
  return {
    ok,
    headers: {
      get: (name: string) => (name.toLowerCase() === "content-type" ? "application/json" : null)
    },
    json: async () => body,
    text: async () => JSON.stringify(body)
  };
}

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
    const fetchMock = vi
      .fn()
      .mockResolvedValue(jsonResponse({ message: "Start with Open local quest.", mode: "general" }));
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
  });

  it("switches between coaching and personal-assistant modes", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({ message: "I can organize that.", mode: "assistant" })
    );
    vi.stubGlobal("fetch", fetchMock);

    render(<AICoachPanel />);
    expect(screen.getByRole("heading", { name: "LifeQuest Agent" })).toBeVisible();
    expect(screen.getByText("Context loaded")).toBeVisible();

    fireEvent.click(screen.getByRole("button", { name: /Assistant/ }));
    fireEvent.click(screen.getByRole("button", { name: /Suggested request/ }));
    expect((screen.getByLabelText("Message") as HTMLTextAreaElement).value).toContain(
      "organize, defer, or archive"
    );
    fireEvent.click(screen.getByRole("button", { name: "Send" }));

    await waitFor(() => expect(screen.getByText("I can organize that.")).toBeVisible());
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.mode).toBe("assistant");
  });

  it("sends prior turns as conversation history", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ message: "Reply.", mode: "general" }));
    vi.stubGlobal("fetch", fetchMock);

    render(<AICoachPanel />);
    fireEvent.change(screen.getByLabelText("Message"), { target: { value: "First message" } });
    fireEvent.click(screen.getByRole("button", { name: "Send" }));
    await waitFor(() => expect(screen.getByText("Reply.")).toBeVisible());

    fireEvent.change(screen.getByLabelText("Message"), { target: { value: "Second message" } });
    fireEvent.click(screen.getByRole("button", { name: "Send" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    const secondBody = JSON.parse(fetchMock.mock.calls[1][1].body);
    expect(secondBody.history).toEqual([
      { role: "user", content: "First message" },
      { role: "assistant", content: "Reply." }
    ]);
  });

  it("persists the conversation and restores it on remount, and 'New chat' starts fresh", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(jsonResponse({ message: "Eat eggs.", mode: "general" }))
    );

    const first = render(<AICoachPanel />);
    fireEvent.change(screen.getByLabelText("Message"), {
      target: { value: "What should I eat for breakfast?" }
    });
    fireEvent.click(screen.getByRole("button", { name: "Send" }));
    await waitFor(() => expect(screen.getByText("Eat eggs.")).toBeVisible());
    first.unmount();

    // Remount: the thread should be reloaded from storage.
    render(<AICoachPanel />);
    await waitFor(() =>
      expect(screen.getByText("What should I eat for breakfast?")).toBeVisible()
    );
    expect(screen.getByText("Eat eggs.")).toBeVisible();
    // It appears in History.
    expect(screen.getByRole("button", { name: /History \(1\)/ })).toBeVisible();

    // New chat clears the transcript but keeps the saved thread.
    fireEvent.click(screen.getByRole("button", { name: "＋ New chat" }));
    await waitFor(() =>
      expect(screen.queryByText("What should I eat for breakfast?")).not.toBeInTheDocument()
    );
    expect(screen.getByRole("button", { name: /History \(1\)/ })).toBeVisible();
  });

  it("lets the coach log a meal (log_food) and saves it on confirm", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        jsonResponse({
          message: "Want me to log that?",
          mode: "general",
          proposals: [
            {
              id: "p-food",
              toolName: "log_food",
              summary: "Log breakfast: oatmeal with berries",
              payload: { description: "Oatmeal with berries", mealType: "breakfast", calories: 320, proteinG: 12 },
              status: "pending",
              createdAt: now,
              updatedAt: now
            }
          ]
        })
      )
    );

    render(<AICoachPanel />);
    fireEvent.change(screen.getByLabelText("Message"), {
      target: { value: "Add oatmeal with berries to breakfast" }
    });
    fireEvent.click(screen.getByRole("button", { name: "Send" }));

    await waitFor(() => expect(screen.getByText("Log breakfast: oatmeal with berries")).toBeVisible());
    fireEvent.click(screen.getByRole("button", { name: "Confirm" }));

    await waitFor(() => {
      const stored = JSON.parse(window.localStorage.getItem(foodEntryStorageKey) ?? "[]");
      expect(stored[0]).toMatchObject({
        description: "Oatmeal with berries",
        mealType: "breakfast",
        macros: { calories: 320, proteinG: 12 }
      });
    });
  });

  it("shows a safe error when the chat request fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(jsonResponse({ error: "AI coach is unavailable right now." }, false))
    );

    render(<AICoachPanel />);

    fireEvent.change(screen.getByLabelText("Message"), { target: { value: "Help" } });
    fireEvent.click(screen.getByRole("button", { name: "Send" }));

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent("AI coach is unavailable right now.");
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
      .mockResolvedValueOnce(
        jsonResponse({
          message: "I found one task proposal for review.",
          mode: "general",
          proposals: [
            {
              id: "proposal-1",
              toolName: "create_task",
              summary: "Create task: Walk on the treadmill tomorrow",
              payload: { title: "Walk on the treadmill tomorrow", tags: ["health"] },
              status: "pending",
              createdAt: now,
              updatedAt: now
            }
          ]
        })
      )
      .mockResolvedValueOnce(
        jsonResponse({
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
      );
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
      expect(screen.getByText(/Done — Created task: Walk on the treadmill tomorrow/)).toBeVisible();
    });
    expect(JSON.parse(window.localStorage.getItem(taskStorageKey) ?? "[]")[0]).toMatchObject({
      title: "Walk on the treadmill tomorrow"
    });
  });

  it("dismisses a proposal without mutating tasks", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        jsonResponse({
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
      )
    );

    render(<AICoachPanel />);

    fireEvent.change(screen.getByLabelText("Message"), { target: { value: "Add a task." } });
    fireEvent.click(screen.getByRole("button", { name: "Send" }));

    await waitFor(() => {
      expect(screen.getByText("Create task: Do not add this")).toBeVisible();
    });
    fireEvent.click(screen.getByRole("button", { name: "Dismiss" }));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Confirm" })).toBeDisabled();
    });
    expect(JSON.parse(window.localStorage.getItem(taskStorageKey) ?? "[]")).toHaveLength(0);
  });
});
