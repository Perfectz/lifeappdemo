import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { GmailIntegrationPanel } from "@/components/GmailIntegrationPanel";

const gmail = vi.hoisted(() => ({
  begin: vi.fn(),
  createDraft: vi.fn(),
  disconnect: vi.fn(),
  inbox: vi.fn(),
  status: vi.fn()
}));

vi.mock("@/client/gmailIntegration", () => ({
  beginGmailConnection: gmail.begin,
  createGmailDraft: gmail.createDraft,
  disconnectGmail: gmail.disconnect,
  getGmailInbox: gmail.inbox,
  getGmailStatus: gmail.status
}));

beforeEach(() => {
  gmail.begin.mockReset();
  gmail.createDraft.mockReset();
  gmail.disconnect.mockReset();
  gmail.inbox.mockReset();
  gmail.status.mockReset();
  window.history.replaceState({}, "", "/settings");
});

describe("GmailIntegrationPanel", () => {
  it("shows a retry action when checking Gmail fails", async () => {
    gmail.status
      .mockRejectedValueOnce(new Error("Could not check Gmail right now."))
      .mockResolvedValueOnce({ configured: true, connected: false });

    render(<GmailIntegrationPanel />);

    expect(await screen.findByRole("alert")).toHaveTextContent("Could not check Gmail right now.");
    fireEvent.click(screen.getByRole("button", { name: "Retry Gmail status" }));
    expect(await screen.findByText("Gmail is not connected")).toBeInTheDocument();
  });

  it("shows missing deployment values without enabling a dead connect button", async () => {
    gmail.status.mockResolvedValue({
      configured: false,
      connected: false,
      missing: ["GOOGLE_OAUTH_CLIENT_ID", "INTEGRATION_ENCRYPTION_KEY"]
    });
    render(<GmailIntegrationPanel />);
    expect(await screen.findByText("Deployment configuration required")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Connect Gmail" })).toBeDisabled();
    expect(screen.getByText(/GOOGLE_OAUTH_CLIENT_ID/)).toBeInTheDocument();
  });

  it("loads an inbox digest and creates a reviewable draft without a send action", async () => {
    gmail.status.mockResolvedValue({ configured: true, connected: true, email: "user@example.com" });
    gmail.inbox.mockResolvedValue({
      query: "is:unread",
      messages: [{ id: "m1", threadId: "t1", from: "Alex", subject: "Project", date: "", snippet: "Can we talk?" }]
    });
    gmail.createDraft.mockResolvedValue({ id: "draft-1" });
    render(<GmailIntegrationPanel />);
    expect(await screen.findByText("user@example.com")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /send/i })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Load inbox digest" }));
    expect(await screen.findByText("Project")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("To"), { target: { value: "alex@example.com" } });
    fireEvent.change(screen.getByLabelText("Subject"), { target: { value: "Re: Project" } });
    fireEvent.change(screen.getByLabelText("Message"), { target: { value: "Yes, tomorrow works." } });
    fireEvent.click(screen.getByRole("button", { name: "Create draft" }));

    await waitFor(() => expect(gmail.createDraft).toHaveBeenCalledWith({
      to: "alex@example.com",
      subject: "Re: Project",
      body: "Yes, tomorrow works."
    }));
    expect(await screen.findByText("Draft created in Gmail. Nothing was sent.")).toBeInTheDocument();
  });
});
