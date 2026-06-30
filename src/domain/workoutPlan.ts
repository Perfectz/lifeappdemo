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
import { workoutTypes } from "@/domain/workouts";
import type { IsoDate, IsoDateTime, WorkoutType } from "@/domain/types";

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
    swaps: asStringArray(r.swaps, 6)
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
