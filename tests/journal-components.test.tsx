import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { Journal } from "@/components/Journal";
import { journalStorageKey } from "@/data/journalRepository";
import type { JournalEntry } from "@/domain";

const now = "2026-05-04T12:00:00.000Z";

function makeEntry(overrides: Partial<JournalEntry> = {}): JournalEntry {
  return {
    id: "journal-1",
    date: "2026-05-04",
    type: "lesson",
    prompt: "What did I learn today?",
    content: "Small loops beat vague ambition.",
    source: "manual",
    createdAt: now,
    updatedAt: now,
    ...overrides
  };
}

describe("Journal", () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.restoreAllMocks();
  });

  it("attaches a selected prompt when saving", async () => {
    render(<Journal />);

    fireEvent.change(screen.getByLabelText("Prompt"), {
      target: { value: "What did I learn today?" }
    });
    fireEvent.change(screen.getByLabelText("Content"), {
      target: { value: "Prompt helped the lesson land." }
    });
    fireEvent.click(screen.getByRole("button", { name: "Save Journal Entry" }));

    await waitFor(() => {
      expect(screen.getByText("Journal entry saved.")).toBeVisible();
    });
    expect(
      within(screen.getByRole("region", { name: "Recent journal entries" })).getByText(
        "What did I learn today?"
      )
    ).toBeVisible();

    const raw = window.localStorage.getItem(journalStorageKey);
    expect(JSON.parse(raw ?? "[]")[0]).toMatchObject({
      prompt: "What did I learn today?",
      content: "Prompt helped the lesson land."
    });
  });

  it("edits an existing entry", async () => {
    window.localStorage.setItem(journalStorageKey, JSON.stringify([makeEntry()]));

    render(<Journal />);

    await waitFor(() => {
      expect(screen.getByText("Small loops beat vague ambition.")).toBeVisible();
    });
    fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    fireEvent.change(screen.getByLabelText("Content"), {
      target: { value: "Edited journal lesson." }
    });
    fireEvent.click(screen.getByRole("button", { name: "Save Journal Edit" }));

    await waitFor(() => {
      expect(screen.getByText("Journal entry updated.")).toBeVisible();
    });
    expect(screen.getByText("Edited journal lesson.")).toBeVisible();
    expect(screen.queryByText("Small loops beat vague ambition.")).not.toBeInTheDocument();
  });

  it("deletes an entry after confirmation", async () => {
    window.localStorage.setItem(journalStorageKey, JSON.stringify([makeEntry()]));
    vi.spyOn(window, "confirm").mockReturnValue(true);

    render(<Journal />);

    await waitFor(() => {
      expect(screen.getByText("Small loops beat vague ambition.")).toBeVisible();
    });
    fireEvent.click(screen.getByRole("button", { name: "Delete" }));

    await waitFor(() => {
      expect(screen.getByText("Journal entry deleted.")).toBeVisible();
    });
    expect(screen.queryByText("Small loops beat vague ambition.")).not.toBeInTheDocument();
  });
});
