"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { playRestDone } from "@/client/sfx";

/**
 * Compact between-sets rest countdown, shown after a strength log. Runs on
 * wall-clock timestamps (Date.now diff against a target end time), so a
 * backgrounded / throttled tab snaps back to the correct remaining time on
 * the next tick instead of drifting like accumulated setInterval math would.
 * Never blocks logging — it's a dismissible chip pinned above the tabbar.
 */

export const restTimerStorageKey = "lifequest.rest-timer.v1";

export const restTimerDurations = [60, 90, 120, 180] as const;
const DEFAULT_DURATION_S = 90;
const TICK_MS = 250;
const DONE_AUTO_DISMISS_MS = 6000;

export function loadRestTimerDuration(storage?: Storage): number {
  const store = storage ?? (typeof window !== "undefined" ? window.localStorage : undefined);
  if (!store) return DEFAULT_DURATION_S;
  try {
    const raw = store.getItem(restTimerStorageKey);
    if (!raw) return DEFAULT_DURATION_S;
    const parsed = JSON.parse(raw) as { durationSeconds?: unknown };
    const value = Number(parsed?.durationSeconds);
    return (restTimerDurations as readonly number[]).includes(value) ? value : DEFAULT_DURATION_S;
  } catch {
    return DEFAULT_DURATION_S;
  }
}

function saveRestTimerDuration(durationSeconds: number): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(restTimerStorageKey, JSON.stringify({ durationSeconds }));
  } catch {
    // non-fatal
  }
}

function formatMmSs(ms: number): string {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

export function RestTimer({ onDismiss }: { onDismiss: () => void }) {
  const [durationS, setDurationS] = useState(() => loadRestTimerDuration());
  const [remainingMs, setRemainingMs] = useState(() => durationS * 1000);
  const [paused, setPaused] = useState(false);
  const [done, setDone] = useState(false);
  const endAtRef = useRef<number>(Date.now() + durationS * 1000);
  const doneSfxFiredRef = useRef(false);

  // Wall-clock ticking: recompute remaining from the target timestamp so a
  // backgrounded tab corrects itself; cleans up on pause/done/unmount.
  useEffect(() => {
    if (paused || done) return;
    const tick = () => {
      const remaining = endAtRef.current - Date.now();
      if (remaining <= 0) {
        setRemainingMs(0);
        setDone(true);
        if (!doneSfxFiredRef.current) {
          doneSfxFiredRef.current = true;
          playRestDone();
        }
        return;
      }
      setRemainingMs(remaining);
    };
    tick();
    const id = window.setInterval(tick, TICK_MS);
    const onVisible = () => {
      if (document.visibilityState === "visible") tick();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [paused, done]);

  // Once the rest is over, quietly leave on our own so the chip never lingers.
  useEffect(() => {
    if (!done) return;
    const id = window.setTimeout(onDismiss, DONE_AUTO_DISMISS_MS);
    return () => window.clearTimeout(id);
  }, [done, onDismiss]);

  const selectDuration = useCallback((next: number) => {
    setDurationS(next);
    saveRestTimerDuration(next);
    endAtRef.current = Date.now() + next * 1000;
    doneSfxFiredRef.current = false;
    setRemainingMs(next * 1000);
    setDone(false);
    setPaused(false);
  }, []);

  const togglePause = useCallback(() => {
    setPaused((wasPaused) => {
      if (wasPaused) {
        // Resume from the frozen remaining time.
        endAtRef.current = Date.now() + remainingMs;
        return false;
      }
      // Freeze the exact remaining time at the pause moment.
      setRemainingMs(Math.max(0, endAtRef.current - Date.now()));
      return true;
    });
  }, [remainingMs]);

  const fraction = Math.max(0, Math.min(1, remainingMs / (durationS * 1000)));

  return (
    <div
      className={`rest-timer${done ? " rest-timer-done" : ""}`}
      role="timer"
      aria-label="Rest timer"
      aria-live="off"
    >
      <div className="rest-timer-head">
        <span className="rest-timer-label">{done ? "Rest over — go!" : "Rest"}</span>
        <strong className="rest-timer-time">{formatMmSs(remainingMs)}</strong>
        <div className="rest-timer-durations" role="group" aria-label="Rest duration">
          {restTimerDurations.map((seconds) => (
            <button
              key={seconds}
              type="button"
              className={
                seconds === durationS
                  ? "rest-timer-duration rest-timer-duration-active"
                  : "rest-timer-duration"
              }
              aria-pressed={seconds === durationS}
              onClick={() => selectDuration(seconds)}
            >
              {seconds}s
            </button>
          ))}
        </div>
        {!done ? (
          <button type="button" className="rest-timer-action" onClick={togglePause}>
            {paused ? "Resume" : "Pause"}
          </button>
        ) : null}
        <button
          type="button"
          className="rest-timer-action"
          aria-label="Skip rest"
          onClick={onDismiss}
        >
          Skip
        </button>
      </div>
      <div className="rest-timer-bar" aria-hidden="true">
        <span className="rest-timer-bar-fill" style={{ width: `${fraction * 100}%` }} />
      </div>
    </div>
  );
}
