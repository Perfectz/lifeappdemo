/**
 * "Today's Workout" — an AI- (or deterministically-) chosen daily plan across
 * the three buckets (strength / cardio / martial arts). Each suggestion is
 * either a PRESET (references the existing library by id) or a CUSTOM session
 * the coach generated. Completing ANY one bucket makes a good day; the rest are
 * bonus.
 *
 * Pure + framework-free. The parser is guardrailed against a catalog so a model
 * can't invent a preset id that doesn't exist.
 */

import {
  cardioOptions,
  martialArtsOptions,
  strengthVariants,
  strengthWorkouts,
  type StrengthVariant
} from "@/config/fitness";
import { buildVinnySession, formatVinnyPrescriptionLine } from "@/domain/coachProgram";
import {
  buildProgressiveSession,
  formatPrescriptionLine,
  type ExercisePrescription,
  type StrengthFocus
} from "@/domain/strengthProgression";
import type { TrainingProfile } from "@/domain/trainingProfile";
import { workoutTypes } from "@/domain/workouts";
import type { IsoDate, IsoDateTime, Workout, WorkoutType } from "@/domain/types";

export const workoutSuggestionKinds = ["preset", "custom"] as const;
export type WorkoutSuggestionKind = (typeof workoutSuggestionKinds)[number];

export type WorkoutSuggestion = {
  bucket: WorkoutType;
  kind: WorkoutSuggestionKind;
  title: string;
  estMinutes?: number;
  rationale: string;
  /** preset only: id into the relevant library; strength also carries a variant. */
  presetId?: string;
  variant?: StrengthVariant;
  /** custom only: free-form session lines / description. */
  exercises?: string[];
  description?: string;
  /** injury-aware swap notes shown to the user. */
  swaps?: string[];
  /**
   * strength only: exact sets×reps×load programming in the user's coach
   * style. Optional for backward compat — old cached plans won't have it.
   */
  prescriptions?: ExercisePrescription[];
  /** One coach-toned line on where the progression stands. */
  progressionSummary?: string;
};

export type DailyWorkoutPlan = {
  date: IsoDate;
  items: WorkoutSuggestion[];
  note?: string;
  source: "ai" | "computed";
  createdAt: IsoDateTime;
};

/** Valid preset ids per bucket — the guardrail set + prompt catalog. */
export type WorkoutCatalog = Record<WorkoutType, { id: string; label: string }[]>;

export function buildWorkoutCatalog(): WorkoutCatalog {
  return {
    strength: strengthWorkouts.map((w) => ({ id: w.id, label: `Day ${w.day} — ${w.name}` })),
    cardio: cardioOptions.map((o) => ({ id: o.id, label: o.label })),
    martial_arts: martialArtsOptions.map((o) => ({ id: o.id, label: o.label }))
  };
}

/** Compact catalog text for the AI prompt. */
export function formatCatalogForPrompt(catalog: WorkoutCatalog): string {
  const line = (bucket: WorkoutType, name: string) =>
    `${name} presets: ${catalog[bucket].map((o) => `${o.id} (${o.label})`).join("; ")}`;
  return [
    line("strength", "Strength"),
    `Strength variants: ${strengthVariants.join(", ")}`,
    line("cardio", "Cardio"),
    line("martial_arts", "Martial arts")
  ].join("\n");
}

/* --------------------------------------------------------------- parsing -- */

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function asStringArray(value: unknown, cap = 12): string[] {
  if (!Array.isArray(value)) return [];
  return value.map(asString).filter(Boolean).slice(0, cap);
}

function isWorkoutType(value: unknown): value is WorkoutType {
  return typeof value === "string" && workoutTypes.includes(value as WorkoutType);
}

function isStrengthVariant(value: unknown): value is StrengthVariant {
  return typeof value === "string" && strengthVariants.includes(value as StrengthVariant);
}

function boundedInt(value: unknown, min: number, max: number): number | undefined {
  const num = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(num)) return undefined;
  const rounded = Math.round(num);
  return rounded >= min && rounded <= max ? rounded : undefined;
}

function parsePrescription(value: unknown): ExercisePrescription | null {
  const r = (value && typeof value === "object" ? value : {}) as Record<string, unknown>;
  const exercise = asString(r.exercise);
  const sets = boundedInt(r.sets, 1, 10);
  const reps = boundedInt(r.reps, 1, 50);
  if (!exercise || !sets || !reps) return null;
  const weightRaw = typeof r.weightLbs === "number" ? r.weightLbs : Number(r.weightLbs);
  const weightLbs =
    Number.isFinite(weightRaw) && weightRaw > 0 && weightRaw <= 2000
      ? Math.round(weightRaw * 2) / 2
      : undefined;
  return {
    exercise: exercise.slice(0, 120),
    sets,
    reps,
    weightLbs,
    note: asString(r.note).slice(0, 300) || undefined,
    // Split-style extras (Vinny): muscle-group header + set-scheme label.
    group: asString(r.group).slice(0, 40) || undefined,
    scheme: asString(r.scheme).slice(0, 160) || undefined
  };
}

function parsePrescriptions(value: unknown): ExercisePrescription[] | undefined {
  if (!Array.isArray(value)) return undefined;
  // 12 covers a full Vinny day (3+3+3 on A, 3+3+1 on B) with headroom.
  const parsed = value
    .map(parsePrescription)
    .filter((p): p is ExercisePrescription => p !== null)
    .slice(0, 12);
  return parsed.length > 0 ? parsed : undefined;
}

function parseSuggestion(value: unknown, catalog: WorkoutCatalog): WorkoutSuggestion | null {
  const r = (value && typeof value === "object" ? value : {}) as Record<string, unknown>;
  if (!isWorkoutType(r.bucket)) return null;
  const bucket = r.bucket;

  let kind: WorkoutSuggestionKind = r.kind === "custom" ? "custom" : "preset";
  let presetId = asString(r.presetId) || undefined;

  // Guardrail: a "preset" must reference a real id; otherwise treat it as custom.
  if (kind === "preset") {
    const valid = catalog[bucket].some((o) => o.id === presetId);
    if (!valid) {
      kind = "custom";
      presetId = undefined;
    }
  }

  const variant =
    bucket === "strength" && isStrengthVariant(r.variant) ? r.variant : bucket === "strength" ? "Free Weight" : undefined;

  const estRaw = typeof r.estMinutes === "number" ? r.estMinutes : Number(r.estMinutes);
  const estMinutes = Number.isFinite(estRaw) ? Math.max(0, Math.min(240, Math.round(estRaw))) : undefined;

  const fallbackTitle =
    kind === "preset" && presetId
      ? catalog[bucket].find((o) => o.id === presetId)?.label ?? "Session"
      : "Custom session";

  return {
    bucket,
    kind,
    title: asString(r.title) || fallbackTitle,
    estMinutes,
    rationale: asString(r.rationale),
    presetId,
    variant,
    exercises: asStringArray(r.exercises),
    description: asString(r.description) || undefined,
    swaps: asStringArray(r.swaps, 6),
    prescriptions: bucket === "strength" ? parsePrescriptions(r.prescriptions) : undefined,
    progressionSummary: asString(r.progressionSummary).slice(0, 400) || undefined
  };
}

/** Tolerant parse → one suggestion per bucket (first wins), guardrailed to the catalog. */
export function parseDailyWorkoutPlan(
  value: unknown,
  catalog: WorkoutCatalog,
  date: IsoDate,
  now: IsoDateTime,
  source: "ai" | "computed" = "ai"
): DailyWorkoutPlan {
  const r = (value && typeof value === "object" ? value : {}) as Record<string, unknown>;
  const rawItems = Array.isArray(r.items) ? r.items : [];
  const byBucket = new Map<WorkoutType, WorkoutSuggestion>();
  for (const raw of rawItems) {
    const parsed = parseSuggestion(raw, catalog);
    if (parsed && !byBucket.has(parsed.bucket)) {
      byBucket.set(parsed.bucket, parsed);
    }
  }
  return {
    date,
    items: workoutTypes.map((b) => byBucket.get(b)).filter((x): x is WorkoutSuggestion => Boolean(x)),
    note: asString(r.note) || undefined,
    source,
    createdAt: now
  };
}

/* --------------------------------------------------------- deterministic -- */

/** Pick the next strength day in rotation based on the last logged strength day. */
function nextStrengthDayId(recentStrengthTitles: string[]): string {
  // Titles look like "Day 3 — Legs & Core · Free Weight"; find the latest day #.
  const lastDay = recentStrengthTitles
    .map((t) => {
      const m = /Day (\d+)/.exec(t);
      return m ? Number(m[1]) : 0;
    })
    .find((n) => n > 0);
  const ids = strengthWorkouts.map((w) => w.id);
  if (!lastDay) return ids[0];
  const idx = strengthWorkouts.findIndex((w) => w.day === lastDay);
  return ids[(idx + 1) % ids.length] ?? ids[0];
}

/**
 * Deterministic plan used when the AI is unavailable: rotate the strength day,
 * default an easy cardio + a martial-arts option. Always valid presets.
 */
export function buildDeterministicPlan(
  recentStrengthTitles: string[],
  date: IsoDate,
  now: IsoDateTime
): DailyWorkoutPlan {
  const catalog = buildWorkoutCatalog();
  const strengthId = nextStrengthDayId(recentStrengthTitles);
  const strengthLabel = catalog.strength.find((o) => o.id === strengthId)?.label ?? "Strength";

  const items: WorkoutSuggestion[] = [
    {
      bucket: "strength",
      kind: "preset",
      presetId: strengthId,
      variant: "Free Weight",
      title: strengthLabel,
      estMinutes: 40,
      rationale: "Next strength day in your rotation.",
      swaps: []
    },
    {
      bucket: "cardio",
      kind: "preset",
      presetId: "walk",
      title: "Walk",
      estMinutes: 30,
      rationale: "Easy zone-2 to support fat loss without taxing recovery.",
      swaps: []
    },
    {
      bucket: "martial_arts",
      kind: "preset",
      presetId: "shadowboxing",
      title: "Shadowboxing rounds",
      estMinutes: 15,
      rationale: "Light skill work — keeps the martial-arts habit alive.",
      swaps: []
    }
  ];

  return {
    date,
    items,
    note: "Auto-picked from your rotation. Do any one to win the day — the rest are bonus.",
    source: "computed",
    createdAt: now
  };
}

/* ------------------------------------------------- martial arts (solo) -- */

export type SoloConditioningSession = {
  id: string;
  title: string;
  description: string;
  estMinutes: number;
};

/** Non-class-day martial-arts rotation: solo skill + conditioning work. */
export const soloConditioningSessions: SoloConditioningSession[] = [
  {
    id: "kata",
    title: "Kata practice",
    description:
      "Run each kata you know 3× — first slow for precision, then at speed, then eyes closed for balance. Finish with 2 min of stance holds.",
    estMinutes: 20
  },
  {
    id: "bagwork",
    title: "Bagwork combinations",
    description:
      "5 rounds × 2 min on the bag: round 1 jab-cross, round 2 add hooks, round 3 kicks only, rounds 4–5 free combinations. 30s rest between rounds.",
    estMinutes: 20
  },
  {
    id: "footwork",
    title: "Footwork + agility drills",
    description:
      "4 rounds: shadowbox moving only (no power), ladder or line drills, lateral shuffles with level changes, then sprawl-to-stance × 10.",
    estMinutes: 15
  },
  {
    id: "conditioning",
    title: "Conditioning rounds (3×3 min)",
    description:
      "3 × 3-min rounds, 1 min rest: nonstop shadowboxing with knees and kicks — fight pace. Last 30 seconds of each round all-out.",
    estMinutes: 15
  }
];

/** Deterministic non-class-day pick: rotate through the solo sessions by date. */
export function pickSoloConditioning(date: IsoDate): SoloConditioningSession {
  const t = Date.parse(`${date}T00:00:00Z`);
  const dayIndex = Number.isNaN(t) ? 0 : Math.floor(t / 86_400_000);
  return soloConditioningSessions[((dayIndex % soloConditioningSessions.length) + soloConditioningSessions.length) % soloConditioningSessions.length];
}

/** The martial-arts suggestion for a day the user already has karate class. */
export function karateClassSuggestion(): WorkoutSuggestion {
  return {
    bucket: "martial_arts",
    kind: "custom",
    title: "Karate class ✓ counts as today's session",
    estMinutes: 10,
    description: "Optional 10-min mobility cooldown after class: hips, hamstrings, shoulders.",
    rationale: "You're already on the mat today — class is the session.",
    swaps: []
  };
}

function soloConditioningSuggestion(date: IsoDate): WorkoutSuggestion {
  const session = pickSoloConditioning(date);
  return {
    bucket: "martial_arts",
    kind: "custom",
    title: session.title,
    estMinutes: session.estMinutes,
    description: session.description,
    rationale: "No class today — solo work keeps the skills sharp.",
    swaps: []
  };
}

/* ------------------------------------------------- progressive fallback -- */

/** The strength suggestion in the user's coach style (Vinny split vs. simple progressive). */
function strengthSuggestion(
  profile: TrainingProfile,
  workouts: Workout[],
  focus?: StrengthFocus
): WorkoutSuggestion {
  if (profile.coachStyle === "vinny_split") {
    const session = buildVinnySession({ profile, workouts });
    return {
      bucket: "strength",
      kind: "custom",
      title: session.title,
      estMinutes: session.estMinutes,
      rationale: "Next day in your coach's split — ascending triples, then rotate the accessories.",
      exercises: session.prescriptions.map(formatVinnyPrescriptionLine),
      description: session.tip,
      prescriptions: session.prescriptions,
      progressionSummary: session.summary,
      swaps: []
    };
  }
  const session = buildProgressiveSession(profile, workouts, focus);
  return {
    bucket: "strength",
    kind: "custom",
    title: session.title,
    estMinutes: session.estMinutes,
    rationale: "Next step in your linear progression — add a little every session.",
    exercises: session.prescriptions.map(formatPrescriptionLine),
    prescriptions: session.prescriptions,
    progressionSummary: session.summary,
    swaps: []
  };
}

/**
 * Offline/deterministic plan with real programming: a strength session in the
 * user's coach style (Vinny split by default, else simple progressive) with
 * exact sets×reps×loads from the progression engine, easy cardio, and
 * class-aware martial arts.
 */
export function buildProgressivePlan(
  profile: TrainingProfile,
  workouts: Workout[],
  date: IsoDate,
  now: IsoDateTime,
  options: { karateToday?: boolean; focus?: StrengthFocus } = {}
): DailyWorkoutPlan {
  const items: WorkoutSuggestion[] = [
    strengthSuggestion(profile, workouts, options.focus),
    {
      bucket: "cardio",
      kind: "preset",
      presetId: "walk",
      title: "Walk",
      estMinutes: 30,
      rationale: "Easy zone-2 to support recovery between lifting days.",
      swaps: []
    },
    options.karateToday ? karateClassSuggestion() : soloConditioningSuggestion(date)
  ];

  return {
    date,
    items,
    note: "Programmed from your training log. Do any one to win the day — the rest are bonus.",
    source: "computed",
    createdAt: now
  };
}

/* ----------------------------------------------------------------- guard -- */

export function isDailyWorkoutPlan(value: unknown): value is DailyWorkoutPlan {
  if (!value || typeof value !== "object") return false;
  const p = value as Partial<DailyWorkoutPlan>;
  return (
    typeof p.date === "string" &&
    Array.isArray(p.items) &&
    typeof p.createdAt === "string" &&
    (p.source === "ai" || p.source === "computed")
  );
}
