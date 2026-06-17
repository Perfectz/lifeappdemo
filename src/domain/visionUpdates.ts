/**
 * Shapes + validation for the image-to-update flow. The vision model returns a
 * summary of what it saw, a confidence level, an optional clarifying question
 * (when it's unsure), and a list of proposed updates that map onto the app's
 * action tools. Proposals are executed only after the user confirms.
 *
 * This module is pure (no network/DOM) so it can validate the model's output
 * on the server and be unit-tested.
 */

export type VisionConfidence = "high" | "medium" | "low";

export type VisionProposal = {
  /** A voice/app tool name, e.g. "log_cardio", "log_metric". */
  tool: string;
  args: Record<string, unknown>;
  /** Human-readable description of the proposed change. */
  label: string;
};

export type VisionResult = {
  summary: string;
  confidence: VisionConfidence;
  /** Present when the model needs more detail before it's confident. */
  question?: string;
  proposals: VisionProposal[];
};

const CONFIDENCES: VisionConfidence[] = ["high", "medium", "low"];

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function asText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeConfidence(value: unknown): VisionConfidence {
  const text = asText(value).toLowerCase();
  return CONFIDENCES.includes(text as VisionConfidence) ? (text as VisionConfidence) : "low";
}

function normalizeProposal(value: unknown): VisionProposal | null {
  if (!isRecord(value)) return null;
  const tool = asText(value.tool);
  if (!tool) return null;
  const args = isRecord(value.args) ? value.args : {};
  const label = asText(value.label) || tool.replace(/_/g, " ");
  return { tool, args, label };
}

/** Validate/normalize whatever the vision model returned into a VisionResult. */
export function parseVisionResult(value: unknown): VisionResult {
  if (!isRecord(value)) {
    return {
      summary: "I couldn't read anything from that image.",
      confidence: "low",
      proposals: []
    };
  }

  const proposals = Array.isArray(value.proposals)
    ? value.proposals.map(normalizeProposal).filter((p): p is VisionProposal => p !== null)
    : [];

  const question = asText(value.question);
  // No proposals + nothing asked → at least nudge the user for detail.
  const effectiveQuestion =
    question || (proposals.length === 0 ? "I couldn't tell what to log — can you describe it?" : "");

  return {
    summary: asText(value.summary) || "Reviewed the image.",
    confidence: normalizeConfidence(value.confidence),
    question: effectiveQuestion || undefined,
    proposals
  };
}

/** True when the UI should push the user for more detail before applying. */
export function shouldRequestDetail(result: VisionResult): boolean {
  return Boolean(result.question) || result.confidence === "low" || result.proposals.length === 0;
}
