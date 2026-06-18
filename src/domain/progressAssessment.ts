/**
 * The AI's read on a set of progress photos vs. the user's stated future-self
 * goal. Deterministic, tolerant parsing so a slightly-off model response never
 * crashes the UI.
 */

export const progressAlignments = ["on_track", "needs_work", "unclear"] as const;
export type ProgressAlignment = (typeof progressAlignments)[number];

export const progressAlignmentLabel: Record<ProgressAlignment, string> = {
  on_track: "On track",
  needs_work: "Keep pushing",
  unclear: "Need clearer photos"
};

export type ProgressAssessment = {
  summary: string;
  alignment: ProgressAlignment;
  observations: string[];
  encouragement: string;
  /** Optional rough visual estimate, e.g. "20–24%". Never a medical figure. */
  estimatedBodyFatRange?: string;
};

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.map(asString).filter(Boolean).slice(0, 8);
}

export function parseProgressAssessment(value: unknown): ProgressAssessment {
  const record = (value && typeof value === "object" ? value : {}) as Record<string, unknown>;

  const alignmentRaw = asString(record.alignment).toLowerCase().replace(/[\s-]+/g, "_");
  const alignment: ProgressAlignment = progressAlignments.includes(alignmentRaw as ProgressAlignment)
    ? (alignmentRaw as ProgressAlignment)
    : "unclear";

  const summary = asString(record.summary) || "No assessment was returned.";
  const observations = asStringArray(record.observations);
  const encouragement = asString(record.encouragement);
  const estimatedBodyFatRange = asString(record.estimatedBodyFatRange) || undefined;

  return {
    summary,
    alignment,
    observations,
    encouragement,
    estimatedBodyFatRange
  };
}
