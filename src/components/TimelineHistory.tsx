"use client";

import { useMemo, useState } from "react";

import { TimelineResultCard } from "@/components/TimelineResultCard";
import { deleteCheckinFromCloud } from "@/client/timelineCloud";
import { deleteTimelineCheckin } from "@/data/timelineCheckinRepository";
import {
  timelineDirectionLabel,
  type TimelineCheckin
} from "@/domain/timelineMirror";

type TimelineHistoryProps = {
  checkins: TimelineCheckin[];
  onChange: () => void;
};

/** Tiny inline sparkline of timeline score over time (oldest → newest). */
function ScoreTrend({ scores }: { scores: { score: number; date: string }[] }) {
  if (scores.length < 2) return null;
  const width = 280;
  const height = 64;
  const pad = 6;
  const max = 100;
  const stepX = (width - pad * 2) / (scores.length - 1);
  const points = scores
    .map((s, i) => {
      const x = pad + i * stepX;
      const y = height - pad - (s.score / max) * (height - pad * 2);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
  const last = scores[scores.length - 1];

  return (
    <div className="timeline-trend">
      <h4>Timeline trend</h4>
      <svg viewBox={`0 0 ${width} ${height}`} className="timeline-trend-svg" role="img" aria-label="Timeline score trend over time">
        {/* neutral midline at 50 */}
        <line
          x1={pad}
          x2={width - pad}
          y1={height - pad - 0.5 * (height - pad * 2)}
          y2={height - pad - 0.5 * (height - pad * 2)}
          className="timeline-trend-mid"
        />
        <polyline points={points} className="timeline-trend-line" fill="none" />
      </svg>
      <p className="timeline-trend-caption">
        Latest: {last.score}/100 ({scores.length} check-ins)
      </p>
    </div>
  );
}

export function TimelineHistory({ checkins, onChange }: TimelineHistoryProps) {
  const trend = useMemo(
    () =>
      [...checkins]
        .reverse()
        .map((c) => ({ score: c.result.timelineScore, date: c.date })),
    [checkins]
  );

  const [expandedId, setExpandedId] = useState<string | null>(null);

  function remove(id: string) {
    deleteTimelineCheckin(id);
    void deleteCheckinFromCloud(id);
    if (expandedId === id) setExpandedId(null);
    onChange();
  }

  if (checkins.length === 0) {
    return (
      <div className="timeline-panel">
        <p className="reminders-help">
          No check-ins yet. Read your timeline on the Mirror tab and your history will build here.
        </p>
      </div>
    );
  }

  return (
    <div className="timeline-panel">
      <ScoreTrend scores={trend} />

      <ul className="timeline-history-list">
        {checkins.map((c) => {
          const open = expandedId === c.id;
          return (
            <li key={c.id} className="timeline-history-item">
              <button
                type="button"
                className="timeline-history-toggle"
                aria-expanded={open}
                onClick={() => setExpandedId(open ? null : c.id)}
              >
                <span className="timeline-history-head">
                  <span className="timeline-history-caret" aria-hidden="true">
                    {open ? "▾" : "▸"}
                  </span>
                  <span className="timeline-history-date">{c.date}</span>
                  <span className="timeline-history-score">{c.result.timelineScore}/100</span>
                  <span className={`timeline-direction timeline-direction-${c.result.direction}`}>
                    {timelineDirectionLabel[c.result.direction]}
                  </span>
                  {c.result.backslideDetected ? (
                    <span className="timeline-history-backslide">⚠️</span>
                  ) : null}
                </span>
                <span className="timeline-history-bar">
                  <span
                    className="timeline-history-bar-fill"
                    style={{ width: `${c.result.timelineScore}%` }}
                  />
                </span>
              </button>

              {open ? (
                <div className="timeline-history-detail">
                  <TimelineResultCard result={c.result} />
                </div>
              ) : (
                c.result.jrpgMessage && (
                  <p className="timeline-history-msg">🔮 {c.result.jrpgMessage}</p>
                )
              )}

              <button
                type="button"
                className="command-button timeline-history-delete"
                onClick={() => remove(c.id)}
              >
                <span>Delete</span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
