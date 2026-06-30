/**
 * Timeline Mirror — the JRPG "morality crystal" read on which timeline the hero
 * is currently feeding: their Ideal Version ("Patrick 2.0") or their Warning
 * Version ("Shadow Patrick").
 *
 * Everything here is pure + framework-free: const unions for the enums, a
 * single tolerant `parseTimelineMirrorResult` so a slightly-off model response
 * never crashes the UI (same defensive style as parseProgressAssessment), and
 * small helpers shared by the client, server, and tests.
 */

import type { IsoDate, IsoDateTime } from "@/domain/types";

/* ------------------------------------------------------------------ enums -- */

/** Which pole of the user's reference library an image belongs to. */
export const referenceImageRoles = ["baseline", "ideal", "warning"] as const;
export type ReferenceImageRole = (typeof referenceImageRoles)[number];

export const referenceImageRoleLabel: Record<ReferenceImageRole, string> = {
  baseline: "Baseline",
  ideal: "Ideal Timeline",
  warning: "Warning Timeline"
};

/** Camera framing of a photo. Forgiving: `unknown` is always valid. */
export const poseTypes = [
  "front_full_body",
  "right_side_full_body",
  "face_upper_45",
  "unknown"
] as const;
export type PoseType = (typeof poseTypes)[number];

export const poseTypeLabel: Record<PoseType, string> = {
  front_full_body: "Front · full body",
  right_side_full_body: "Right side · full body",
  face_upper_45: "45° face / upper body",
  unknown: "Other / unknown"
};

/** Direction of travel between the two timelines. */
export const timelineDirections = [
  "toward_ideal",
  "toward_warning",
  "stable",
  "unclear"
] as const;
export type TimelineDirection = (typeof timelineDirections)[number];

export const timelineDirectionLabel: Record<TimelineDirection, string> = {
  toward_ideal: "Improving",
  toward_warning: "Backsliding",
  stable: "Holding steady",
  unclear: "Unclear"
};

export const confidenceLevels = ["low", "medium", "high"] as const;
export type Confidence = (typeof confidenceLevels)[number];

export const questDifficulties = ["easy", "medium", "hard"] as const;
export type QuestDifficulty = (typeof questDifficulties)[number];

export const questCategories = [
  "movement",
  "nutrition",
  "sleep",
  "grooming",
  "training",
  "mindset",
  "recovery"
] as const;
export type QuestCategory = (typeof questCategories)[number];

/* ------------------------------------------------------------------ types -- */

export type PhotoUsability = {
  usable: boolean;
  /** 0–100 — rough technical quality of the photo (lighting, framing, focus). */
  qualityScore: number;
  issues: string[];
  retakeRecommended: boolean;
  retakeReason: string | null;
};

export type TimelineNextQuest = {
  title: string;
  description: string;
  difficulty: QuestDifficulty;
  xpReward: number;
  category: QuestCategory;
};

/** The full structured read returned by the AI for one check-in. */
export type TimelineMirrorResult = {
  /** 0 = full Warning Timeline, 50 = neutral, 100 = strongly Ideal Timeline. */
  timelineScore: number;
  idealPercent: number;
  warningPercent: number;
  direction: TimelineDirection;
  backslideDetected: boolean;
  confidence: Confidence;
  photoTypeDetected: PoseType;
  photoUsability: PhotoUsability;
  visualSummary: string;
  dataSummary: string;
  overallRead: string;
  positiveSignal: string;
  warningSignal: string;
  nextQuest: TimelineNextQuest;
  jrpgMessage: string;
  coachNote: string;
};

/* ----------------------------------------------------------- persistence -- */

/** Metadata for a stored reference image (the bytes live on-device). */
export type TimelineReferenceImage = {
  id: string;
  role: ReferenceImageRole;
  poseType: PoseType;
  /** Key into the on-device image store (IndexedDB). */
  imageLocalId: string;
  notes?: string;
  createdAt: IsoDateTime;
};

export type TimelineIdentityDocType = "ideal_version" | "warning_version";

export const timelineIdentityDocTypeLabel: Record<TimelineIdentityDocType, string> = {
  ideal_version: "Ideal Version",
  warning_version: "Warning Version"
};

export type TimelineIdentityDoc = {
  id: string;
  docType: TimelineIdentityDocType;
  title: string;
  markdownContent: string;
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
};

/** One persisted check-in: the AI result plus the timestamp + detected pose. */
export type TimelineCheckin = {
  id: string;
  date: IsoDate;
  detectedPoseType: PoseType;
  result: TimelineMirrorResult;
  createdAt: IsoDateTime;
};

/* ------------------------------------------------------------ predicates -- */

export function isReferenceImageRole(value: unknown): value is ReferenceImageRole {
  return typeof value === "string" && referenceImageRoles.includes(value as ReferenceImageRole);
}

export function isPoseType(value: unknown): value is PoseType {
  return typeof value === "string" && poseTypes.includes(value as PoseType);
}

export function isTimelineIdentityDocType(value: unknown): value is TimelineIdentityDocType {
  return value === "ideal_version" || value === "warning_version";
}

export function isTimelineReferenceImage(value: unknown): value is TimelineReferenceImage {
  if (!value || typeof value !== "object") return false;
  const r = value as Record<string, unknown>;
  return (
    typeof r.id === "string" &&
    isReferenceImageRole(r.role) &&
    isPoseType(r.poseType) &&
    typeof r.imageLocalId === "string" &&
    typeof r.createdAt === "string"
  );
}

export function isTimelineIdentityDoc(value: unknown): value is TimelineIdentityDoc {
  if (!value || typeof value !== "object") return false;
  const r = value as Record<string, unknown>;
  return (
    typeof r.id === "string" &&
    isTimelineIdentityDocType(r.docType) &&
    typeof r.title === "string" &&
    typeof r.markdownContent === "string" &&
    typeof r.createdAt === "string" &&
    typeof r.updatedAt === "string"
  );
}

export function isTimelineCheckin(value: unknown): value is TimelineCheckin {
  if (!value || typeof value !== "object") return false;
  const r = value as Record<string, unknown>;
  return (
    typeof r.id === "string" &&
    typeof r.date === "string" &&
    isPoseType(r.detectedPoseType) &&
    Boolean(r.result) &&
    typeof r.result === "object" &&
    typeof r.createdAt === "string"
  );
}

/* --------------------------------------------------------- parse helpers -- */

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function asStringArray(value: unknown, cap = 8): string[] {
  if (!Array.isArray(value)) return [];
  return value.map(asString).filter(Boolean).slice(0, cap);
}

function clampPercent(value: unknown, fallback: number): number {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(0, Math.min(100, Math.round(n)));
}

function normalizeEnum(value: unknown): string {
  return asString(value).toLowerCase().replace(/[\s-]+/g, "_");
}

function oneOf<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  const normalized = normalizeEnum(value);
  return allowed.includes(normalized as T) ? (normalized as T) : fallback;
}

function parsePhotoUsability(value: unknown): PhotoUsability {
  const r = (value && typeof value === "object" ? value : {}) as Record<string, unknown>;
  const usable = r.usable !== false; // default to usable unless explicitly false
  const retakeReason = asString(r.retakeReason) || null;
  return {
    usable,
    qualityScore: clampPercent(r.qualityScore, usable ? 70 : 30),
    issues: asStringArray(r.issues, 6),
    retakeRecommended: r.retakeRecommended === true || !usable,
    retakeReason
  };
}

function parseNextQuest(value: unknown): TimelineNextQuest {
  const r = (value && typeof value === "object" ? value : {}) as Record<string, unknown>;
  const xpRaw = typeof r.xpReward === "number" ? r.xpReward : Number(r.xpReward);
  const xpReward = Number.isFinite(xpRaw) ? Math.max(0, Math.min(9999, Math.round(xpRaw))) : 25;
  return {
    title: asString(r.title) || "Prove the better timeline is still active",
    description:
      asString(r.description) ||
      "Take one clean action today — a short walk, a protein-first meal, or an early night.",
    difficulty: oneOf(r.difficulty, questDifficulties, "easy"),
    xpReward,
    category: oneOf(r.category, questCategories, "movement")
  };
}

/**
 * Tolerant parse of the AI's JSON into a guaranteed-valid TimelineMirrorResult.
 * Never throws: clamps the score, normalizes enums, and back-fills the
 * ideal/warning split from the score when the model omits or contradicts it.
 */
export function parseTimelineMirrorResult(value: unknown): TimelineMirrorResult {
  const r = (value && typeof value === "object" ? value : {}) as Record<string, unknown>;

  const timelineScore = clampPercent(r.timelineScore, 50);

  // Trust the score as the source of truth for the split. Use the model's
  // idealPercent only if it's coherent with the score (within 5 pts); else
  // derive it. warningPercent is always the complement so the two sum to 100.
  const modelIdeal =
    typeof r.idealPercent === "number" || typeof r.idealPercent === "string"
      ? clampPercent(r.idealPercent, timelineScore)
      : timelineScore;
  const idealPercent = Math.abs(modelIdeal - timelineScore) <= 5 ? modelIdeal : timelineScore;
  const warningPercent = 100 - idealPercent;

  const direction = oneOf(r.direction, timelineDirections, "unclear");
  const usability = parsePhotoUsability(r.photoUsability);

  // A backslide is true if the model says so OR the direction clearly drifts.
  const backslideDetected = r.backslideDetected === true || direction === "toward_warning";

  return {
    timelineScore,
    idealPercent,
    warningPercent,
    direction,
    backslideDetected,
    confidence: oneOf(r.confidence, confidenceLevels, "medium"),
    photoTypeDetected: oneOf(r.photoTypeDetected, poseTypes, "unknown"),
    photoUsability: usability,
    visualSummary: asString(r.visualSummary) || "No visual read was returned.",
    dataSummary: asString(r.dataSummary) || "No data read was returned.",
    overallRead: asString(r.overallRead) || "The mirror's image is hazy — try again.",
    positiveSignal: asString(r.positiveSignal),
    warningSignal: asString(r.warningSignal),
    nextQuest: parseNextQuest(r.nextQuest),
    jrpgMessage:
      asString(r.jrpgMessage) || "Mirror Crystal flickers: the timeline is still being written.",
    coachNote: asString(r.coachNote)
  };
}
