"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { dataChangedEventName } from "@/data/createLocalRepository";
import { loadTimelineCheckins } from "@/data/timelineCheckinRepository";
import {
  timelineDirectionLabel,
  type TimelineCheckin
} from "@/domain/timelineMirror";

/**
 * Dashboard widget surfacing the latest Timeline Mirror reading so the identity
 * check-in is visible from the daily hub (not buried behind a nav item).
 */
export function TimelineMirrorCard() {
  const [latest, setLatest] = useState<TimelineCheckin | null>(null);

  const reload = useCallback(() => {
    setLatest(loadTimelineCheckins()[0] ?? null);
  }, []);

  useEffect(() => {
    reload();
    window.addEventListener(dataChangedEventName, reload);
    return () => window.removeEventListener(dataChangedEventName, reload);
  }, [reload]);

  return (
    <section className="dashboard-section timeline-card" aria-label="Timeline Mirror">
      <div className="timeline-card-head">
        <p className="eyebrow">Mirror Crystal</p>
        <Link href="/timeline-mirror" className="timeline-link">
          {latest ? "Open mirror →" : "Consult the mirror →"}
        </Link>
      </div>

      {latest ? (
        <>
          <div className="timeline-card-score">
            <span className="timeline-card-num">{latest.result.timelineScore}</span>
            <span className="timeline-card-outof">/100</span>
            <span
              className={`timeline-direction timeline-direction-${latest.result.direction}`}
            >
              {timelineDirectionLabel[latest.result.direction]}
            </span>
            {latest.result.backslideDetected ? (
              <span className="timeline-chip timeline-chip-warn">Backslide</span>
            ) : null}
          </div>
          <div className="timeline-card-bar">
            <div
              className="timeline-card-bar-fill"
              style={{ width: `${latest.result.timelineScore}%` }}
            />
          </div>
          {latest.result.jrpgMessage ? (
            <p className="timeline-card-msg">🔮 {latest.result.jrpgMessage}</p>
          ) : null}
          <p className="timeline-card-date">Last checkpoint: {latest.date}</p>
        </>
      ) : (
        <p className="reminders-help">
          Which timeline are you feeding — Ideal Self or Shadow Self? Upload a checkpoint photo to
          find out.
        </p>
      )}
    </section>
  );
}
