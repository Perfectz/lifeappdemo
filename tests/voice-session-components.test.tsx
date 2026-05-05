import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { VoiceSessionPanel } from "@/components/VoiceSessionPanel";

function localStorageContents(): string {
  return Array.from({ length: window.localStorage.length }, (_, index) => {
    const key = window.localStorage.key(index);
    return key ? `${key}:${window.localStorage.getItem(key) ?? ""}` : "";
  }).join("\n");
}

function mockMicrophoneSuccess() {
  Object.defineProperty(navigator, "mediaDevices", {
    configurable: true,
    value: {
      getUserMedia: vi.fn().mockResolvedValue({
        getTracks: () => [{ stop: vi.fn() }]
      } as unknown as MediaStream)
    }
  });
}

function mockMicrophoneDenied() {
  Object.defineProperty(navigator, "mediaDevices", {
    configurable: true,
    value: {
      getUserMedia: vi.fn().mockRejectedValue(new Error("denied"))
    }
  });
}

describe("VoiceSessionPanel", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    Reflect.deleteProperty(navigator, "mediaDevices");
  });

  it("starts, stops, and hands the transcript to the text AI flow without storing the token", async () => {
    mockMicrophoneSuccess();
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        clientSecret: "ek_test_voice_secret",
        expiresAt: "2026-05-05T09:10:00.000Z",
        mode: "morning",
        credentialSource: "mock"
      })
    });
    vi.stubGlobal("fetch", fetchMock);
    const handoff = vi.fn();

    render(
      <VoiceSessionPanel
        mode="morning"
        onFallbackToText={vi.fn()}
        onTranscriptHandoff={handoff}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Start Voice Session" }));

    await waitFor(() => {
      expect(screen.getByText("active")).toBeVisible();
    });
    expect(screen.getByText("granted")).toBeVisible();
    expect(screen.getByText("mock")).toBeVisible();
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/realtime/session",
      expect.objectContaining({
        body: JSON.stringify({ mode: "morning" })
      })
    );

    fireEvent.click(screen.getByRole("button", { name: "Stop Voice Session" }));
    await waitFor(() => {
      expect(screen.getByText("ended")).toBeVisible();
    });
    fireEvent.change(screen.getByLabelText("Transcript"), {
      target: { value: "Voice said to protect the main quest." }
    });
    fireEvent.click(screen.getByRole("button", { name: "Hand off to text AI" }));

    expect(handoff).toHaveBeenCalledWith("Voice said to protect the main quest.");
    expect(localStorageContents()).not.toContain("ek_test_voice_secret");
  });

  it("shows a text fallback when microphone permission is denied", async () => {
    mockMicrophoneDenied();
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const fallback = vi.fn();

    render(
      <VoiceSessionPanel
        mode="evening"
        onFallbackToText={fallback}
        onTranscriptHandoff={vi.fn()}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Start Voice Session" }));

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent(
        "Microphone permission was denied. Use text mode instead."
      );
    });
    expect(screen.getByText("denied")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Fallback to text mode" }));
    expect(fallback).toHaveBeenCalledTimes(1);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
