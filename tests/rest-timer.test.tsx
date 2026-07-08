import { act, fireEvent, render, screen } from "@testing-library/react";
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { loadRestTimerDuration, RestTimer, restTimerStorageKey } from "@/components/RestTimer";

describe("RestTimer", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    window.localStorage.clear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("defaults to a 90 second countdown", () => {
    render(<RestTimer onDismiss={vi.fn()} />);
    expect(screen.getByRole("timer")).toHaveTextContent("01:30");
  });

  it("counts down on wall-clock time", () => {
    render(<RestTimer onDismiss={vi.fn()} />);
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(screen.getByRole("timer")).toHaveTextContent("01:29");
  });

  it("recovers the correct remaining time after a backgrounded-tab jump", () => {
    render(<RestTimer onDismiss={vi.fn()} />);
    // Simulate a throttled tab: the wall clock leaps 30s with no interim ticks.
    act(() => {
      vi.setSystemTime(Date.now() + 30_000);
      vi.advanceTimersByTime(250);
    });
    expect(screen.getByRole("timer")).toHaveTextContent("01:00");
  });

  it("persists the chosen duration and restores it on the next mount", () => {
    const { unmount } = render(<RestTimer onDismiss={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "120s" }));
    expect(screen.getByRole("timer")).toHaveTextContent("02:00");

    const raw = window.localStorage.getItem(restTimerStorageKey);
    expect(raw).not.toBeNull();
    expect(JSON.parse(raw!)).toEqual({ durationSeconds: 120 });
    expect(loadRestTimerDuration()).toBe(120);

    unmount();
    render(<RestTimer onDismiss={vi.fn()} />);
    expect(screen.getByRole("timer")).toHaveTextContent("02:00");
  });

  it("falls back to 90s when the stored value is invalid", () => {
    window.localStorage.setItem(restTimerStorageKey, JSON.stringify({ durationSeconds: 42 }));
    expect(loadRestTimerDuration()).toBe(90);
    window.localStorage.setItem(restTimerStorageKey, "not json");
    expect(loadRestTimerDuration()).toBe(90);
  });

  it("pauses and resumes without losing time", () => {
    render(<RestTimer onDismiss={vi.fn()} />);
    act(() => {
      vi.advanceTimersByTime(10_000);
    });
    fireEvent.click(screen.getByRole("button", { name: "Pause" }));
    act(() => {
      vi.advanceTimersByTime(30_000);
    });
    // Frozen while paused.
    expect(screen.getByRole("timer")).toHaveTextContent("01:20");
    fireEvent.click(screen.getByRole("button", { name: "Resume" }));
    act(() => {
      vi.advanceTimersByTime(5_000);
    });
    expect(screen.getByRole("timer")).toHaveTextContent("01:15");
  });

  it("finishes at zero and auto-dismisses shortly after", () => {
    const onDismiss = vi.fn();
    render(<RestTimer onDismiss={onDismiss} />);
    act(() => {
      vi.advanceTimersByTime(90_000);
    });
    expect(screen.getByRole("timer")).toHaveTextContent("00:00");
    expect(screen.getByRole("timer")).toHaveTextContent("Rest over");
    expect(onDismiss).not.toHaveBeenCalled();
    act(() => {
      vi.advanceTimersByTime(6_000);
    });
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it("skip dismisses immediately", () => {
    const onDismiss = vi.fn();
    render(<RestTimer onDismiss={onDismiss} />);
    fireEvent.click(screen.getByRole("button", { name: "Skip rest" }));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });
});
