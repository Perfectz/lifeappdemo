"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { fileToDownscaledDataUrl } from "@/client/imageDownscale";
import { SectionHeader } from "@/components/SectionHeader";
import { TimelineHistory } from "@/components/TimelineHistory";
import { TimelineIdentityEditor } from "@/components/TimelineIdentityEditor";
import { TimelineReferenceManager } from "@/components/TimelineReferenceManager";
import { TimelineResultCard } from "@/components/TimelineResultCard";
import { buildTimelineContext } from "@/client/timelineContext";
import { pushCheckinToCloud } from "@/client/timelineCloud";
import {
  loadHydratedReferences,
  loadReferenceInputs,
  type HydratedReference
} from "@/client/timelineReferences";
import { seedTimelineForPatrick } from "@/client/timelineSeed";
import {
  addTimelineCheckin,
  loadTimelineCheckins
} from "@/data/timelineCheckinRepository";
import { timelineImageChangedEvent } from "@/data/timelineImageStore";
import { toLocalIsoDate } from "@/domain/dates";
import {
  parseTimelineMirrorResult,
  poseTypeLabel,
  type PoseType,
  type ReferenceImageRole,
  type TimelineCheckin,
  type TimelineMirrorResult
} from "@/domain/timelineMirror";

type View = "mirror" | "history" | "setup";

function uid(): string {
  return `chk_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function daysSince(iso: string): number {
  const then = Date.parse(iso);
  if (Number.isNaN(then)) return Infinity;
  return Math.floor((Date.now() - then) / 86_400_000);
}

/** Weeks (Mon-anchored) with at least one check-in, counting back from now. */
function weeklyStreak(checkins: TimelineCheckin[]): number {
  if (checkins.length === 0) return 0;
  const weekKey = (ms: number) => Math.floor((ms - 4 * 86_400_000) / (7 * 86_400_000));
  const weeks = new Set(
    checkins.map((c) => weekKey(Date.parse(c.createdAt))).filter((n) => !Number.isNaN(n))
  );
  let streak = 0;
  let cursor = weekKey(Date.now());
  while (weeks.has(cursor)) {
    streak += 1;
    cursor -= 1;
  }
  return streak;
}

function pickReference(
  refs: HydratedReference[],
  role: ReferenceImageRole,
  pose: PoseType
): HydratedReference | null {
  const sameRole = refs.filter((r) => r.role === role);
  return (
    sameRole.find((r) => r.poseType === pose) ??
    sameRole.find((r) => r.poseType === "front_full_body") ??
    sameRole[0] ??
    null
  );
}

const LOADING_LINES = [
  "Polishing the Mirror Crystal…",
  "Summoning your Ideal and Shadow selves…",
  "Reading posture, presence, and timeline drift…",
  "Cross-checking your photo against the rubric…",
  "Consulting your habit data…"
];

function CrystalLoading() {
  const [i, setI] = useState(0);
  useEffect(() => {
    const t = window.setInterval(() => setI((v) => (v + 1) % LOADING_LINES.length), 1800);
    return () => window.clearInterval(t);
  }, []);
  return (
    <div className="timeline-loading" role="status" aria-live="polite">
      <div className="timeline-loading-orb" aria-hidden="true" />
      <div className="timeline-loading-skeleton" aria-hidden="true">
        <div className="timeline-skel-bar" />
        <div className="timeline-skel-marker" />
      </div>
      <p className="timeline-loading-line">{LOADING_LINES[i]}</p>
    </div>
  );
}

function ComparisonStrip({
  current,
  ideal,
  warning
}: {
  current: string;
  ideal: HydratedReference | null;
  warning: HydratedReference | null;
}) {
  return (
    <div className="timeline-compare" aria-label="You compared to your timelines">
      <figure className="timeline-compare-item timeline-compare-warning">
        {warning ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={warning.dataUrl} alt="Warning timeline reference" />
        ) : (
          <div className="timeline-compare-empty">No warning ref</div>
        )}
        <figcaption>Shadow Self</figcaption>
      </figure>
      <figure className="timeline-compare-item timeline-compare-you">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={current} alt="Your checkpoint photo" />
        <figcaption>You today</figcaption>
      </figure>
      <figure className="timeline-compare-item timeline-compare-ideal">
        {ideal ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={ideal.dataUrl} alt="Ideal timeline reference" />
        ) : (
          <div className="timeline-compare-empty">No ideal ref</div>
        )}
        <figcaption>Ideal Self</figcaption>
      </figure>
    </div>
  );
}

export function TimelineMirror() {
  const [view, setView] = useState<View>("mirror");
  const [photoDataUrl, setPhotoDataUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [reading, setReading] = useState(false);
  const [result, setResult] = useState<TimelineMirrorResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [checkins, setCheckins] = useState<TimelineCheckin[]>([]);
  const [references, setReferences] = useState<HydratedReference[]>([]);
  const [seedNote, setSeedNote] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement | null>(null);
  const resultRef = useRef<HTMLDivElement | null>(null);

  const reloadCheckins = useCallback(() => setCheckins(loadTimelineCheckins()), []);
  const reloadReferences = useCallback(() => {
    void loadHydratedReferences().then(setReferences);
  }, []);

  useEffect(() => {
    let cancelled = false;
    const loadReferences = () => {
      void loadHydratedReferences().then((refs) => {
        if (!cancelled) setReferences(refs);
      });
    };
    reloadCheckins();
    loadReferences();
    void seedTimelineForPatrick().then((res) => {
      if (cancelled || !res.seeded) return;
      setSeedNote(
        `Loaded your timelines (${res.references} reference photos + your rubrics). Manage them anytime via the gear.`
      );
      loadReferences();
    });
    return () => {
      cancelled = true;
    };
  }, [reloadCheckins]);

  // Keep the comparison strip fresh if references change in Setup.
  useEffect(() => {
    window.addEventListener(timelineImageChangedEvent, reloadReferences);
    return () => window.removeEventListener(timelineImageChangedEvent, reloadReferences);
  }, [reloadReferences]);

  // Bring the result into view the moment it arrives — no hunting by scroll.
  useEffect(() => {
    if (result && resultRef.current) {
      resultRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [result]);

  const lastCheckin = checkins[0];
  const streak = useMemo(() => weeklyStreak(checkins), [checkins]);
  const cadence = useMemo(() => {
    if (!lastCheckin) {
      return { overdue: true, label: "First checkpoint — upload today's photo." };
    }
    const days = daysSince(lastCheckin.createdAt);
    if (days >= 7) {
      return { overdue: true, label: `Checkpoint overdue (${days} days). Time for a reading.` };
    }
    return { overdue: false, label: `Next checkpoint in ${7 - days} day${7 - days === 1 ? "" : "s"}.` };
  }, [lastCheckin]);

  const hasReferences = references.length > 0;

  async function handleFile(file: File) {
    setError(null);
    setBusy(true);
    try {
      const dataUrl = await fileToDownscaledDataUrl(file, 1024);
      setPhotoDataUrl(dataUrl);
      setResult(null);
    } catch {
      setError("Couldn't read that image. Try a different photo.");
    } finally {
      setBusy(false);
    }
  }

  async function readTimeline() {
    if (!photoDataUrl) {
      setError("Upload a checkpoint photo first.");
      return;
    }
    setReading(true);
    setError(null);
    try {
      const ctx = buildTimelineContext();
      const refInputs = await loadReferenceInputs();
      const response = await fetch("/api/ai/timeline-mirror", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentPhoto: { dataUrl: photoDataUrl, poseType: "unknown" },
          references: refInputs,
          idealMarkdown: ctx.idealMarkdown,
          warningMarkdown: ctx.warningMarkdown,
          profileContext: ctx.profileContext,
          lifeDataSummary: ctx.lifeDataSummary
        })
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error ?? "The Mirror Crystal went cloudy.");
      }
      const parsed = parseTimelineMirrorResult(data);
      setResult(parsed);

      if (parsed.photoUsability.usable) {
        const checkin: TimelineCheckin = {
          id: uid(),
          date: toLocalIsoDate(),
          detectedPoseType: parsed.photoTypeDetected,
          result: parsed,
          createdAt: new Date().toISOString()
        };
        addTimelineCheckin(checkin);
        void pushCheckinToCloud(checkin);
        reloadCheckins();
      }
    } catch (readError) {
      setError(readError instanceof Error ? readError.message : "Reading failed.");
    } finally {
      setReading(false);
    }
  }

  function resetForNewPhoto() {
    setPhotoDataUrl(null);
    setResult(null);
    setError(null);
    fileInput.current?.click();
  }

  const comparison = result ? (
    <ComparisonStrip
      current={photoDataUrl ?? ""}
      ideal={pickReference(references, "ideal", result.photoTypeDetected)}
      warning={pickReference(references, "warning", result.photoTypeDetected)}
    />
  ) : null;

  return (
    <section className="dashboard-section timeline-mirror" aria-label="Timeline Mirror">
      <div className="timeline-topbar">
        <SectionHeader eyebrow="Mirror Crystal" title="Which timeline are you feeding?" />
        <div className="timeline-header-actions">
          <button
            type="button"
            className={`timeline-iconbtn ${view === "history" ? "is-active" : ""}`}
            onClick={() => setView(view === "history" ? "mirror" : "history")}
            aria-pressed={view === "history"}
          >
            📊 History
          </button>
          <button
            type="button"
            className={`timeline-iconbtn ${view === "setup" ? "is-active" : ""}`}
            onClick={() => setView(view === "setup" ? "mirror" : "setup")}
            aria-pressed={view === "setup"}
          >
            ⚙ Manage timelines
          </button>
        </div>
      </div>

      {error ? (
        <p className="form-error" role="alert">
          {error}
        </p>
      ) : null}

      {/* ---------------- SETUP ---------------- */}
      {view === "setup" ? (
        <div className="timeline-panel">
          <button type="button" className="timeline-back" onClick={() => setView("mirror")}>
            ← Back to mirror
          </button>
          <TimelineReferenceManager />
          <TimelineIdentityEditor />
        </div>
      ) : null}

      {/* ---------------- HISTORY ---------------- */}
      {view === "history" ? (
        <div className="timeline-panel">
          <button type="button" className="timeline-back" onClick={() => setView("mirror")}>
            ← Back to mirror
          </button>
          <TimelineHistory checkins={checkins} onChange={reloadCheckins} />
        </div>
      ) : null}

      {/* ---------------- MIRROR (home) ---------------- */}
      {view === "mirror" ? (
        <div className="timeline-panel">
          {seedNote ? <p className="reminders-help timeline-nudge">{seedNote}</p> : null}

          <div className={`timeline-streak ${cadence.overdue ? "is-overdue" : ""}`}>
            <span className="timeline-streak-flame">{streak > 0 ? `🔥 ${streak}-week streak` : "No streak yet"}</span>
            <span className="timeline-streak-cadence">{cadence.label}</span>
          </div>

          {/* First-run guard: references are what make the read meaningful. */}
          {!hasReferences ? (
            <div className="timeline-firstrun">
              <h3>Define your timelines first</h3>
              <p>
                Add a few reference photos of your Ideal Self and Shadow Self (and your identity
                rubrics) so the mirror has something to judge against.
              </p>
              <button
                type="button"
                className="command-button command-button-primary"
                onClick={() => setView("setup")}
              >
                <span>⚙ Set up my timelines</span>
              </button>
            </div>
          ) : null}

          {/* Reading in progress */}
          {reading ? <CrystalLoading /> : null}

          {/* Result first — meter + comparison up top, auto-scrolled into view */}
          {result && !reading ? (
            <div ref={resultRef} className="timeline-result-wrap">
              <div className="timeline-result-uploadrow">
                {photoDataUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img className="timeline-result-thumb" src={photoDataUrl} alt="Your checkpoint photo" />
                ) : null}
                <button type="button" className="command-button" onClick={resetForNewPhoto}>
                  <span>New checkpoint photo</span>
                </button>
              </div>
              <TimelineResultCard result={result} comparison={comparison} />
            </div>
          ) : null}

          {/* Uploader — full size before a reading, hidden while a result shows */}
          {!result && !reading ? (
            <div className="timeline-upload">
              {photoDataUrl ? (
                <>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img className="timeline-upload-preview" src={photoDataUrl} alt="Your checkpoint photo" />
                  <div className="timeline-upload-actions">
                    <button
                      type="button"
                      className="command-button"
                      onClick={() => fileInput.current?.click()}
                      disabled={busy}
                    >
                      <span>Choose another</span>
                    </button>
                    <button
                      type="button"
                      className="command-button command-button-primary"
                      onClick={() => void readTimeline()}
                    >
                      <span>🔮 Read my timeline</span>
                    </button>
                  </div>
                </>
              ) : (
                <button
                  type="button"
                  className="timeline-upload-empty"
                  onClick={() => fileInput.current?.click()}
                  disabled={busy}
                >
                  {busy ? "Loading…" : "+ Upload checkpoint photo"}
                </button>
              )}
            </div>
          ) : null}

          <input
            ref={fileInput}
            type="file"
            accept="image/*"
            className="visually-hidden"
            aria-label="Upload checkpoint photo"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void handleFile(file);
              event.target.value = "";
            }}
          />

          {/* Recent checkpoints preview */}
          {checkins.length > 0 ? (
            <div className="timeline-recent">
              <div className="timeline-recent-head">
                <h3>Recent checkpoints</h3>
                <button type="button" className="timeline-link" onClick={() => setView("history")}>
                  View all history →
                </button>
              </div>
              <ul className="timeline-recent-list">
                {checkins.slice(0, 3).map((c) => (
                  <li key={c.id} className="timeline-recent-item">
                    <span className="timeline-recent-date">{c.date}</span>
                    <span className="timeline-recent-score">{c.result.timelineScore}/100</span>
                    <span className="timeline-recent-bar">
                      <span
                        className="timeline-recent-bar-fill"
                        style={{ width: `${c.result.timelineScore}%` }}
                      />
                    </span>
                    <span className="timeline-recent-pose">
                      {poseTypeLabel[c.detectedPoseType]}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
