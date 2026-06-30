"use client";

import { useState, type ReactNode } from "react";

import { acceptTimelineQuest } from "@/client/timelineQuest";
import { TimelineMeter } from "@/components/TimelineMeter";
import {
  poseTypeLabel,
  type TimelineMirrorResult
} from "@/domain/timelineMirror";

type TimelineResultCardProps = {
  result: TimelineMirrorResult;
  /** Rendered directly under the meter — e.g. the You/Ideal/Warning strip. */
  comparison?: ReactNode;
};

const difficultyLabel: Record<string, string> = {
  easy: "Easy",
  medium: "Medium",
  hard: "Hard"
};

export function TimelineResultCard({ result, comparison }: TimelineResultCardProps) {
  const [questAccepted, setQuestAccepted] = useState(false);

  function acceptQuest() {
    try {
      acceptTimelineQuest(result.nextQuest);
      setQuestAccepted(true);
    } catch {
      // Non-fatal: leave the button enabled to retry.
    }
  }

  return (
    <div className="timeline-result">
      <TimelineMeter
        score={result.timelineScore}
        idealPercent={result.idealPercent}
        warningPercent={result.warningPercent}
        direction={result.direction}
      />

      {comparison}

      <div className="timeline-result-meta">
        <span className="timeline-chip">Pose: {poseTypeLabel[result.photoTypeDetected]}</span>
        <span className="timeline-chip">Confidence: {result.confidence}</span>
        {result.photoUsability.retakeRecommended ? (
          <span className="timeline-chip timeline-chip-warn">Retake suggested</span>
        ) : null}
      </div>

      {result.backslideDetected ? (
        <p className="timeline-backslide" role="alert">
          ⚠️ {result.warningSignal || "Backslide detected — the villain music has started."}
        </p>
      ) : null}

      <p className="timeline-jrpg">🔮 {result.jrpgMessage}</p>

      <p className="timeline-overall">{result.overallRead}</p>

      <div className="timeline-signals">
        {result.positiveSignal ? (
          <div className="timeline-signal timeline-signal-good">
            <h4>Signal of the Ideal Timeline</h4>
            <p>{result.positiveSignal}</p>
          </div>
        ) : null}
        {result.warningSignal ? (
          <div className="timeline-signal timeline-signal-warn">
            <h4>Signal to watch</h4>
            <p>{result.warningSignal}</p>
          </div>
        ) : null}
      </div>

      <div className="timeline-summaries">
        <div>
          <h4>What the mirror sees</h4>
          <p>{result.visualSummary}</p>
        </div>
        <div>
          <h4>What your data says</h4>
          <p>{result.dataSummary}</p>
        </div>
      </div>

      <div className="timeline-quest">
        <div className="timeline-quest-head">
          <h4>Next Quest</h4>
          <span className="timeline-quest-xp">+{result.nextQuest.xpReward} XP</span>
        </div>
        <p className="timeline-quest-title">{result.nextQuest.title}</p>
        <p className="timeline-quest-desc">{result.nextQuest.description}</p>
        <div className="timeline-quest-tags">
          <span className="timeline-chip">{result.nextQuest.category}</span>
          <span className="timeline-chip">
            {difficultyLabel[result.nextQuest.difficulty] ?? result.nextQuest.difficulty}
          </span>
        </div>
        <button
          type="button"
          className="command-button command-button-primary timeline-quest-accept"
          onClick={acceptQuest}
          disabled={questAccepted}
        >
          <span>{questAccepted ? "✓ Added to Quest Log" : "Accept quest →"}</span>
        </button>
      </div>

      {result.coachNote ? (
        <p className="timeline-coachnote">
          <strong>Coach:</strong> {result.coachNote}
        </p>
      ) : null}
    </div>
  );
}
