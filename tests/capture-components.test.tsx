import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";

import { CaptureWorkspace } from "@/components/CaptureWorkspace";
import { createLocalJournalRepository } from "@/data/journalRepository";
import { createLocalNoteRepository } from "@/data/noteRepository";
import { createLocalTaskRepository } from "@/data/taskRepository";

describe("CaptureWorkspace", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("captures a quest for today", () => {
    render(<CaptureWorkspace />);

    fireEvent.change(screen.getByLabelText("What do you want to capture?"), {
      target: { value: "Book the appointment\nCall after 9am." }
    });
    fireEvent.click(screen.getByRole("button", { name: "Save Quest" }));

    expect(createLocalTaskRepository(window.localStorage).load()[0]).toMatchObject({
      title: "Book the appointment",
      description: "Call after 9am.",
      status: "todo"
    });
    expect(screen.getByText(/Saved as quest/)).toBeVisible();
  });

  it("captures notes and reflections in their own repositories", () => {
    render(<CaptureWorkspace />);

    fireEvent.click(screen.getByRole("button", { name: "Capture as Note" }));
    fireEvent.change(screen.getByLabelText("What do you want to capture?"), {
      target: { value: "Launch idea\nLead with the transformation story." }
    });
    fireEvent.click(screen.getByRole("button", { name: "Save Note" }));
    expect(createLocalNoteRepository(window.localStorage).load()[0]).toMatchObject({
      title: "Launch idea",
      content: "Lead with the transformation story.",
      tags: ["inbox"]
    });

    fireEvent.click(screen.getByRole("button", { name: "Capture as Reflection" }));
    fireEvent.change(screen.getByLabelText("What do you want to capture?"), {
      target: { value: "Smaller plans are easier to finish." }
    });
    fireEvent.click(screen.getByRole("button", { name: "Save Reflection" }));
    expect(createLocalJournalRepository(window.localStorage).load()[0]).toMatchObject({
      type: "freeform",
      content: "Smaller plans are easier to finish."
    });
  });
});
