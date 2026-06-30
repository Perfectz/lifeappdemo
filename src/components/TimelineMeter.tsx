"use client";

import {
  timelineDirectionLabel,
  type TimelineDirection
} from "@/domain/timelineMirror";

type TimelineMeterProps = {
  score: number; // 0-100
  idealPercent: number;
  warningPercent: number;
  direction: TimelineDirection;
};

/**
 * The morality crystal: a Warning ⇄ Ideal gradient bar with a marker at the
 * current timeline score. Pure presentational — no data fetching.
 */
export function TimelineMeter({
  score,
  idealPercent,
  warningPercent,
  direction
}: TimelineMeterProps) {
  const clamped = Math.max(0, Math.min(100, score));

  return (
    <div className="timeline-meter" role="img" aria-label={`Timeline score ${clamped} of 100, ${timelineDirectionLabel[direction]}`}>
      <div className="timeline-meter-poles">
        <span className="timeline-pole timeline-pole-warning">Shadow Self</span>
        <span className={`timeline-direction timeline-direction-${direction}`}>
          {timelineDirectionLabel[direction]}
        </span>
        <span className="timeline-pole timeline-pole-ideal">Ideal Self</span>
      </div>

      <div className="timeline-meter-track">
        <div className="timeline-meter-fill" style={{ width: `${clamped}%` }} />
        <div className="timeline-meter-marker" style={{ left: `${clamped}%` }}>
          <span className="timeline-meter-value">{clamped}</span>
        </div>
      </div>

      <div className="timeline-meter-split">
        <span className="timeline-split-warning">{warningPercent}% Warning</span>
        <span className="timeline-split-ideal">{idealPercent}% Ideal</span>
      </div>
    </div>
  );
}
