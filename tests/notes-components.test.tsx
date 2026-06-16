import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { Notes } from "@/components/Notes";
import { noteStorageKey } from "@/data/noteRepository";
import type { Note } from "@/domain";

const now = "2026-06-16T12:00:00.000Z";

function makeNote(overrides: Partial<Note> = {}): Note {
  return {
    id: "note-1",
    title: "Strategy",
    content: "Keep a scratchpad for loose ideas.",
    tags: ["planning"],
    createdAt: now,
    updatedAt: now,
    ...overrides
  };
}

describe("Notes", () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.restoreAllMocks();
  });

  it("saves a note with tags", async () => {
    render(<Notes />);

    fireEvent.change(screen.getByLabelText("Title"), {
      target: { value: "Call notes" }
    });
    fireEvent.change(screen.getByLabelText("Tags"), {
      target: { value: "work, ideas" }
    });
    fireEvent.change(screen.getByLabelText("Note"), {
      target: { value: "Follow up on the open question." }
    });
    fireEvent.click(screen.getByRole("button", { name: "Save Note" }));

    await waitFor(() => {
      expect(screen.getByText("Note saved.")).toBeVisible();
    });
    expect(
      within(screen.getByRole("region", { name: "Saved notes" })).getByText("Call notes")
    ).toBeVisible();

    const raw = window.localStorage.getItem(noteStorageKey);
    expect(JSON.parse(raw ?? "[]")[0]).toMatchObject({
      title: "Call notes",
      content: "Follow up on the open question.",
      tags: ["work", "ideas"]
    });
  });

  it("edits an existing note", async () => {
    window.localStorage.setItem(noteStorageKey, JSON.stringify([makeNote()]));

    render(<Notes />);

    await waitFor(() => {
      expect(screen.getByText("Keep a scratchpad for loose ideas.")).toBeVisible();
    });
    fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    fireEvent.change(screen.getByLabelText("Note"), {
      target: { value: "Edited note body." }
    });
    fireEvent.click(screen.getByRole("button", { name: "Save Note Edit" }));

    await waitFor(() => {
      expect(screen.getByText("Note updated.")).toBeVisible();
    });
    expect(screen.getByText("Edited note body.")).toBeVisible();
    expect(screen.queryByText("Keep a scratchpad for loose ideas.")).not.toBeInTheDocument();
  });

  it("filters notes by search query", async () => {
    window.localStorage.setItem(
      noteStorageKey,
      JSON.stringify([
        makeNote({ id: "a", title: "Training notes", tags: ["health"] }),
        makeNote({ id: "b", title: "Work notes", content: "Client follow-up.", tags: ["work"] })
      ])
    );

    render(<Notes />);

    await waitFor(() => {
      expect(screen.getByText("Training notes")).toBeVisible();
      expect(screen.getByText("Work notes")).toBeVisible();
    });

    fireEvent.change(screen.getByLabelText("Search"), {
      target: { value: "client" }
    });

    expect(screen.getByText("Work notes")).toBeVisible();
    expect(screen.queryByText("Training notes")).not.toBeInTheDocument();
  });

  it("deletes a note after confirmation", async () => {
    window.localStorage.setItem(noteStorageKey, JSON.stringify([makeNote()]));
    vi.spyOn(window, "confirm").mockReturnValue(true);

    render(<Notes />);

    await waitFor(() => {
      expect(screen.getByText("Keep a scratchpad for loose ideas.")).toBeVisible();
    });
    fireEvent.click(screen.getByRole("button", { name: "Delete" }));

    await waitFor(() => {
      expect(screen.getByText("Note deleted.")).toBeVisible();
    });
    expect(screen.queryByText("Keep a scratchpad for loose ideas.")).not.toBeInTheDocument();
  });
});
