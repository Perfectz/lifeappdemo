"use client";

import { useEffect, useState } from "react";

import { SectionHeader } from "@/components/SectionHeader";
import {
  buildLocalWeeklyReview,
  currentWeekStart,
  getOrComputeWeeklyReview,
  type WeeklyReviewResult
} from "@/client/weeklyReview";
import { addDaysIso } from "@/domain/weeklyReview";
import type { IsoDate } from "@/domain";

function formatRangeLabel(start: IsoDate, end: IsoDate): string {
  const fmt = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" });
  const parse = (date: IsoDate) => {
    const [year, month, day] = date.split("-").map(Number);
    return new Date(year, month - 1, day);
  };
  return `${fmt.format(parse(start))} – ${fmt.format(parse(end))}`;
}

function weekTitle(weekStart: IsoDate): string {
  const thisWeek = currentWeekStart();
  if (weekStart === thisWeek) return "This Week";
  if (weekStart === addDaysIso(thisWeek, -7)) return "Last Week";
  return `Week of ${weekStart}`;
}

const goldAccent = { color: "var(--warning)" } as const;

export function WeekInReview() {
  const [weekStart, setWeekStart] = useState<IsoDate>(() => currentWeekStart());
  const [result, setResult] = useState<WeeklyReviewResult | null>(null);

  useEffect(() => {
    let cancelled = false;

    const load = () => {
      // Deterministic first — instant render — then the AI narrative swaps in.
      setResult(buildLocalWeeklyReview(window.localStorage, weekStart));
      void getOrComputeWeeklyReview(weekStart).then((computed) => {
        if (!cancelled) setResult(computed);
      });
    };

    load();
    window.addEventListener("lifequest:data-changed", load);
    return () => {
      cancelled = true;
      window.removeEventListener("lifequest:data-changed", load);
    };
  }, [weekStart]);

  const isCurrentWeek = weekStart >= currentWeekStart();
  const review = result?.review;
  const narrative = result?.narrative;

  return (
    <section className="dashboard-section" aria-labelledby="week-in-review-title">
      <SectionHeader eyebrow="AI Coach" title="Week in Review" />
      <div
        style={{ alignItems: "center", display: "flex", gap: "0.75rem", marginBottom: "0.85rem" }}
      >
        <button
          aria-label="Previous week"
          onClick={() => setWeekStart((current) => addDaysIso(current, -7))}
          type="button"
        >
          ←
        </button>
        <strong id="week-in-review-title">
          {weekTitle(weekStart)}
          {review ? (
            <span style={{ color: "var(--muted)", fontWeight: 500, marginLeft: "0.5rem" }}>
              {formatRangeLabel(review.range.start, review.range.end)}
            </span>
          ) : null}
        </strong>
        <button
          aria-label="Next week"
          disabled={isCurrentWeek}
          onClick={() => setWeekStart((current) => addDaysIso(current, 7))}
          type="button"
        >
          →
        </button>
      </div>

      {!review || !narrative ? (
        <p className="quest-empty">Building the week&apos;s story…</p>
      ) : review.emptyWeek ? (
        <p className="quest-empty">
          Nothing logged for this week yet — a workout, a meal, or a check-in is all it takes to
          start the story.
        </p>
      ) : (
        <>
          <p>{narrative.narrative}</p>

          {narrative.wins.length > 0 ? (
            <div>
              <p className="eyebrow" style={goldAccent}>
                Wins
              </p>
              <ul>
                {narrative.wins.map((win) => (
                  <li key={win}>
                    <span aria-hidden="true" style={goldAccent}>
                      ★{" "}
                    </span>
                    {win}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {narrative.focus.length > 0 ? (
            <div>
              <p className="eyebrow">Focus for next week</p>
              <ul>
                {narrative.focus.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          ) : null}

          <dl className="metric-snapshot">
            <div>
              <dt>Sessions</dt>
              <dd>
                {review.training.totalSessions} / {review.training.targetSessions}
              </dd>
            </div>
            <div>
              <dt>New PRs</dt>
              <dd style={review.training.newPRs.length > 0 ? goldAccent : undefined}>
                {review.training.newPRs.length}
              </dd>
            </div>
            <div>
              <dt>Avg Intake</dt>
              <dd>
                {review.nutrition.avgCalories !== null
                  ? `${review.nutrition.avgCalories} kcal${
                      review.nutrition.adherencePct !== null
                        ? ` · ${review.nutrition.adherencePct}% adherence`
                        : ""
                    }`
                  : "—"}
              </dd>
            </div>
            <div>
              <dt>Weight Δ</dt>
              <dd>
                {review.body.weightDeltaLbs !== null
                  ? `${review.body.weightDeltaLbs > 0 ? "+" : ""}${review.body.weightDeltaLbs} lb`
                  : "—"}
              </dd>
            </div>
            <div>
              <dt>Avg Sleep</dt>
              <dd>{review.body.avgSleepHours !== null ? `${review.body.avgSleepHours}h` : "—"}</dd>
            </div>
            <div>
              <dt>Quests</dt>
              <dd>
                {review.quests.completed} / {review.quests.planned}
              </dd>
            </div>
          </dl>
        </>
      )}
    </section>
  );
}
