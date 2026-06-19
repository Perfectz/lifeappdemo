/**
 * The "Patrick 2.0" transformation stage — a 1–5 level that advances as the
 * user closes the gap on their weight goal and stays consistent. Purely a
 * motivational view derived from existing data; no new tracking.
 */

export const transformationStages = [1, 2, 3, 4, 5] as const;
export type TransformationStage = (typeof transformationStages)[number];

export type Transformation = {
  stage: TransformationStage;
  label: string;
  /** 0–100 blended progress toward the future self. */
  progressPercent: number;
};

const STAGE_LABEL: Record<TransformationStage, string> = {
  1: "Starting the climb",
  2: "Building momentum",
  3: "Transforming",
  4: "Dialed in",
  5: "Future self unlocked"
};

function clamp(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

export function getTransformation(input: {
  /** Weight-goal progress (0–100) when a goal + readings exist. */
  weightProgressPercent?: number;
  /** Today's alignment percent (0–100). */
  alignmentPercent: number;
}): Transformation {
  // Long-term weight progress dominates; recent consistency lifts it. Before a
  // weight goal is set, alignment alone drives the stage.
  const score =
    input.weightProgressPercent !== undefined
      ? clamp(input.weightProgressPercent * 0.7 + input.alignmentPercent * 0.3)
      : clamp(input.alignmentPercent);

  const stage: TransformationStage =
    score >= 90 ? 5 : score >= 65 ? 4 : score >= 40 ? 3 : score >= 15 ? 2 : 1;

  return { stage, label: STAGE_LABEL[stage], progressPercent: score };
}
