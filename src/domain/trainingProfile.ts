import type { IsoDateTime } from "@/domain/types";

/**
 * The user's training setup + coaching style. This is what the workout coach
 * (AI and deterministic fallback) programs against, replacing the old
 * hardcoded home-equipment inventory in `workouts.ts`. Persisted as a single
 * document ("lifequest.training-profile.v1") and editable from the fitness
 * page.
 */

export type TrainingEquipment = {
  kettlebells: boolean;
  dumbbells: boolean;
  bands: boolean;
  barbell: boolean;
  machines: boolean;
  pullupBar: boolean;
};

export const coachStyles = [
  "vinny_split",
  "simple_progressive",
  "circuits",
  "structured_blocks",
  "varied"
] as const;
export type CoachStyle = (typeof coachStyles)[number];

export const coachStyleLabel: Record<CoachStyle, string> = {
  vinny_split: "Coach's split — ascending triples + accessories (Vinny)",
  simple_progressive: "Simple progressive lifts (5×5-style)",
  circuits: "Circuits",
  structured_blocks: "Structured blocks",
  varied: "Varied / surprise me"
};

export type TrainingProfile = {
  equipment: TrainingEquipment;
  gymAccess: boolean;
  coachStyle: CoachStyle;
  strengthDaysPerWeek?: number;
  notes?: string;
  updatedAt: IsoDateTime;
};

/**
 * Seeded to this user's actual answers: kettlebells + dumbbells + bands at
 * home, plus commercial gym access (barbells + machines). Default coach style
 * is the Vinny split — the user's real strength coach's programming.
 */
export function defaultTrainingProfile(now: IsoDateTime = new Date().toISOString()): TrainingProfile {
  return {
    equipment: {
      kettlebells: true,
      dumbbells: true,
      bands: true,
      barbell: true,
      machines: true,
      pullupBar: false
    },
    gymAccess: true,
    coachStyle: "vinny_split",
    updatedAt: now
  };
}

function isBoolean(value: unknown): value is boolean {
  return typeof value === "boolean";
}

function isEquipment(value: unknown): value is TrainingEquipment {
  if (!value || typeof value !== "object") return false;
  const e = value as Partial<TrainingEquipment>;
  return (
    isBoolean(e.kettlebells) &&
    isBoolean(e.dumbbells) &&
    isBoolean(e.bands) &&
    isBoolean(e.barbell) &&
    isBoolean(e.machines) &&
    isBoolean(e.pullupBar)
  );
}

export function isTrainingProfile(value: unknown): value is TrainingProfile {
  if (!value || typeof value !== "object") return false;
  const p = value as Partial<TrainingProfile>;
  return (
    isEquipment(p.equipment) &&
    isBoolean(p.gymAccess) &&
    typeof p.coachStyle === "string" &&
    (coachStyles as readonly string[]).includes(p.coachStyle) &&
    (p.strengthDaysPerWeek === undefined || typeof p.strengthDaysPerWeek === "number") &&
    (p.notes === undefined || typeof p.notes === "string") &&
    typeof p.updatedAt === "string"
  );
}

/** Compact single-block summary for the AI coach prompt. */
export function formatTrainingProfileForPrompt(profile: TrainingProfile): string {
  const e = profile.equipment;
  const owned = [
    e.kettlebells ? "kettlebells" : "",
    e.dumbbells ? "dumbbells" : "",
    e.bands ? "resistance bands" : "",
    e.barbell ? "barbell" : "",
    e.machines ? "machines" : "",
    e.pullupBar ? "pull-up bar" : ""
  ].filter(Boolean);
  const lines = [
    `Equipment: ${owned.length > 0 ? owned.join(", ") : "bodyweight only"}.`,
    `Gym access: ${profile.gymAccess ? "yes — commercial gym (barbells/machines available)" : "no — home equipment only"}.`,
    `Coach style: ${coachStyleLabel[profile.coachStyle]}.`
  ];
  if (profile.strengthDaysPerWeek) {
    lines.push(`Strength days per week: ${profile.strengthDaysPerWeek}.`);
  }
  if (profile.notes?.trim()) {
    lines.push(`Notes: ${profile.notes.trim()}`);
  }
  return lines.join("\n");
}
