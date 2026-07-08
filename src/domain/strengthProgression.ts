import type { TrainingProfile } from "@/domain/trainingProfile";
import type { IsoDate, Workout } from "@/domain/types";

/**
 * Coach-style linear progression engine ("simple progressive lifts"): a few
 * compound movements, add weight or reps every session, deload after two
 * misses. Pure functions over the logged workout history — used both by the
 * deterministic fallback plan and to feed exact numbers into the AI prompt.
 */

export type ExercisePrescription = {
  exercise: string;
  sets: number;
  reps: number;
  weightLbs?: number;
  /** The coach line, e.g. "Hit 5×5 @ 185 last week — take 190 today." */
  note?: string;
  /** Muscle-group header for split-style sessions ("Chest", "Tris", …). */
  group?: string;
  /** Set-scheme label, e.g. "1 warm-up, then 4 sets increasing weight — triples: 135/155/175/185". */
  scheme?: string;
};

export type ProgressiveSession = {
  focus: StrengthFocus;
  title: string;
  prescriptions: ExercisePrescription[];
  /** One-line summary of where the progression stands. */
  summary: string;
  estMinutes: number;
};

export const strengthFocusRotation = ["squat", "bench", "deadlift", "ohp", "row"] as const;
export type StrengthFocus = (typeof strengthFocusRotation)[number];

const FOCUS_LABEL: Record<StrengthFocus, string> = {
  squat: "Squat",
  bench: "Bench",
  deadlift: "Deadlift",
  ohp: "Overhead press",
  row: "Row"
};

/* ------------------------------------------------------------------ e1RM -- */

/** Epley estimated 1-rep max: w × (1 + reps/30). */
export function epleyE1Rm(weightLbs: number, reps: number): number {
  if (!Number.isFinite(weightLbs) || weightLbs <= 0) return 0;
  const r = Number.isFinite(reps) && reps > 0 ? Math.min(reps, 30) : 1;
  return weightLbs * (1 + r / 30);
}

/** Lowercased name with any parenthetical scheme ("(4 × 8–10)") stripped. */
export function normalizeExerciseName(name: string): string {
  return name
    .toLowerCase()
    .replace(/\(.*?\)/g, " ")
    .replace(/[^a-z0-9\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function matchesExercise(setName: string, exercise: string): boolean {
  const a = normalizeExerciseName(setName);
  const b = normalizeExerciseName(exercise);
  if (!a || !b) return false;
  return a === b || a.includes(b) || b.includes(a);
}

export type ExerciseSession = {
  date: IsoDate;
  /** Heaviest working set that day (by e1RM, falling back to weight). */
  topWeightLbs?: number;
  topReps?: number;
  setCount: number;
  e1Rm?: number;
};

/** Per-session history for one exercise, newest first. */
export function summarizeExerciseHistory(exercise: string, workouts: Workout[]): ExerciseSession[] {
  const sessions: ExerciseSession[] = [];
  for (const workout of workouts) {
    if (workout.type !== "strength" || !Array.isArray(workout.sets)) continue;
    const matching = workout.sets.filter((s) => matchesExercise(s.exercise, exercise));
    if (matching.length === 0) continue;
    let top: { weightLbs?: number; reps?: number; score: number } | undefined;
    for (const set of matching) {
      const score =
        set.weightLbs && set.weightLbs > 0 ? epleyE1Rm(set.weightLbs, set.reps ?? 1) : 0;
      if (!top || score > top.score) {
        top = { weightLbs: set.weightLbs, reps: set.reps, score };
      }
    }
    sessions.push({
      date: workout.date,
      topWeightLbs: top?.weightLbs,
      topReps: top?.reps,
      setCount: matching.length,
      e1Rm:
        top?.weightLbs && top.weightLbs > 0
          ? Math.round(epleyE1Rm(top.weightLbs, top.reps ?? 1))
          : undefined
    });
  }
  return sessions.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
}

/** Best estimated 1RM across the most recent sessions (default last 6). */
export function bestRecentE1Rm(
  exercise: string,
  workouts: Workout[],
  recentSessions = 6
): number | undefined {
  const values = summarizeExerciseHistory(exercise, workouts)
    .slice(0, recentSessions)
    .map((s) => s.e1Rm)
    .filter((v): v is number => typeof v === "number" && v > 0);
  return values.length > 0 ? Math.max(...values) : undefined;
}

/* ----------------------------------------------------------- progression -- */

type LoadKind = "kettlebell" | "barbell_lower" | "isolation" | "standard";

const KETTLEBELL_RE = /kettlebell|\bkb\b|swing/;
const LOWER_RE = /squat|deadlift|lunge|leg\b|leg press|hip|rdl|romanian|calf/;
const DUMBBELL_RE = /dumbbell|\bdb\b|goblet/;
const ISOLATION_RE = /curl|raise|fly|extension|pushdown|shrug|pullover|crunch|twist|pull-apart/;

export function classifyExercise(exercise: string): LoadKind {
  const name = normalizeExerciseName(exercise);
  if (KETTLEBELL_RE.test(name)) return "kettlebell";
  if (LOWER_RE.test(name) && !DUMBBELL_RE.test(name)) return "barbell_lower";
  if (ISOLATION_RE.test(name)) return "isolation";
  return "standard";
}

/** Weight jump per successful session: lower-body barbell +10, isolation +2.5, else +5. */
export function progressionIncrementLbs(exercise: string): number {
  const kind = classifyExercise(exercise);
  if (kind === "barbell_lower") return 10;
  if (kind === "isolation") return 2.5;
  return 5;
}

function roundToStep(value: number, step: number): number {
  return Math.round(value / step) * step;
}

/** Common bell sizes (lb) — the next size up after topping out the rep range. */
const KETTLEBELL_SIZES_LBS = [10, 15, 20, 25, 30, 35, 44, 53, 62, 70];

export function nextKettlebellSizeLbs(currentLbs: number): number {
  const next = KETTLEBELL_SIZES_LBS.find((s) => s > currentLbs);
  return next ?? currentLbs + 10;
}

export type PrescriptionOptions = {
  sets?: number;
  targetReps?: number;
  /** Fixed-load implements progress reps up to this before sizing up. */
  maxReps?: number;
  startWeightLbs?: number;
};

/**
 * Linear-progression call for one exercise:
 * - target reps hit last session → add weight (+2.5–5 upper/DB, +10 lower barbell)
 * - missed once → repeat the weight
 * - missed twice running → deload 10%
 * - fixed-load (kettlebell) → progress reps (e.g. 5→8), then suggest the next bell size
 */
export function getNextPrescription(
  exercise: string,
  history: ExerciseSession[],
  options: PrescriptionOptions = {}
): ExercisePrescription {
  const kind = classifyExercise(exercise);
  const sets = options.sets ?? 3;
  const targetReps = options.targetReps ?? 5;
  const last = history[0];

  if (!last || !last.topWeightLbs || last.topWeightLbs <= 0) {
    return {
      exercise,
      sets,
      reps: targetReps,
      weightLbs: options.startWeightLbs,
      note: `First time on the log — start light, own ${sets}×${targetReps}, and we build from there.`
    };
  }

  const lastWeight = last.topWeightLbs;
  const lastReps = last.topReps;

  if (kind === "kettlebell") {
    const maxReps = options.maxReps ?? 8;
    const doneReps = lastReps ?? targetReps;
    if (doneReps >= maxReps) {
      const nextBell = nextKettlebellSizeLbs(lastWeight);
      return {
        exercise,
        sets,
        reps: targetReps,
        weightLbs: nextBell,
        note: `You owned ${sets}×${maxReps} @ ${lastWeight} lb — grab the next bell (${nextBell} lb) and reset to ${sets}×${targetReps}.`
      };
    }
    const reps = Math.min(doneReps + 1, maxReps);
    return {
      exercise,
      sets,
      reps,
      weightLbs: lastWeight,
      note: `Hit ${sets}×${doneReps} @ ${lastWeight} lb last time — add a rep: ${sets}×${reps} today.`
    };
  }

  // A session counts as a miss only when reps were recorded below target.
  const missed = (s: ExerciseSession | undefined): boolean =>
    Boolean(s && s.topWeightLbs && typeof s.topReps === "number" && s.topReps < targetReps);

  if (missed(last) && missed(history[1]) && (history[1]?.topWeightLbs ?? 0) >= lastWeight) {
    const deloaded = Math.max(roundToStep(lastWeight * 0.9, 5), 5);
    return {
      exercise,
      sets,
      reps: targetReps,
      weightLbs: deloaded,
      note: `Two tough sessions at ${lastWeight} lb — deload to ${deloaded} lb, own ${sets}×${targetReps}, and climb back stronger.`
    };
  }

  if (missed(last)) {
    return {
      exercise,
      sets,
      reps: targetReps,
      weightLbs: lastWeight,
      note: `Missed some reps at ${lastWeight} lb — repeat it today and beat last session's ${lastReps}.`
    };
  }

  const increment = progressionIncrementLbs(exercise);
  const nextWeight = roundToStep(lastWeight + increment, 2.5);
  const lastLine = lastReps ? `${sets}×${lastReps}` : `${sets}×${targetReps}`;
  return {
    exercise,
    sets,
    reps: targetReps,
    weightLbs: nextWeight,
    note: `Hit ${lastLine} @ ${lastWeight} lb last session — take ${nextWeight} lb today.`
  };
}

/* -------------------------------------------------------------- sessions -- */

type ExercisePick = { name: string; opts: PrescriptionOptions };

type FocusTemplate = { main: ExercisePick; secondaries: ExercisePick[] };

function focusTemplate(focus: StrengthFocus, profile: TrainingProfile): FocusTemplate {
  const e = profile.equipment;
  const barbell = e.barbell || profile.gymAccess;
  const machines = e.machines || profile.gymAccess;
  const db = e.dumbbells;
  const kb = e.kettlebells;

  const main5x5 = (name: string): ExercisePick => ({ name, opts: { sets: 5, targetReps: 5 } });
  const main = (name: string): ExercisePick => ({ name, opts: { sets: 4, targetReps: 8 } });
  const secondary = (name: string): ExercisePick => ({ name, opts: { sets: 3, targetReps: 8 } });
  const pump = (name: string): ExercisePick => ({ name, opts: { sets: 3, targetReps: 12 } });

  switch (focus) {
    case "squat":
      return {
        main: barbell
          ? main5x5("Barbell Back Squat")
          : kb
            ? main("Kettlebell Goblet Squat")
            : main("Dumbbell Goblet Squat"),
        secondaries: [
          db ? secondary("Dumbbell Romanian Deadlift") : secondary("Kettlebell Deadlift"),
          machines ? pump("Leg Press") : secondary("Bulgarian Split Squat")
        ]
      };
    case "bench":
      return {
        main: barbell ? main5x5("Barbell Bench Press") : main("Dumbbell Bench Press"),
        secondaries: [
          db ? secondary("Incline Dumbbell Press") : secondary("Push-Up"),
          db ? secondary("One-Arm Dumbbell Row") : pump("Band Pull-Apart")
        ]
      };
    case "deadlift":
      return {
        main: barbell
          ? { name: "Barbell Deadlift", opts: { sets: 3, targetReps: 5 } }
          : kb
            ? main("Kettlebell Deadlift")
            : main("Dumbbell Romanian Deadlift"),
        secondaries: [
          machines ? secondary("Lat Pulldown") : secondary("One-Arm Dumbbell Row"),
          db ? pump("Dumbbell Shrugs") : pump("Kettlebell Shrugs")
        ]
      };
    case "ohp":
      return {
        main: barbell ? main5x5("Barbell Overhead Press") : main("Dumbbell Shoulder Press"),
        secondaries: [
          db ? pump("Dumbbell Lateral Raise") : pump("Band Lateral Raise"),
          e.bands ? pump("Band Pull-Apart") : pump("Incline Dumbbell Reverse Fly")
        ]
      };
    case "row":
      return {
        main: barbell ? main5x5("Barbell Row") : main("One-Arm Dumbbell Row"),
        secondaries: [
          machines ? secondary("Lat Pulldown") : secondary("Dumbbell Pullover"),
          db ? pump("Dumbbell Curl") : pump("Kettlebell Curl")
        ]
      };
  }
}

const FOCUS_RE: [StrengthFocus, RegExp][] = [
  ["squat", /squat/],
  ["deadlift", /deadlift/],
  ["bench", /bench press|chest press|floor press/],
  ["ohp", /overhead press|shoulder press|military press/],
  ["row", /barbell row|dumbbell row|bent-over row|seated .*row/]
];

function focusOfWorkout(workout: Workout): StrengthFocus | undefined {
  const haystacks = [
    normalizeExerciseName(workout.title ?? ""),
    ...(workout.sets ?? []).map((s) => normalizeExerciseName(s.exercise))
  ];
  for (const [focus, re] of FOCUS_RE) {
    if (haystacks.some((h) => re.test(h))) return focus;
  }
  return undefined;
}

/** Next main-lift focus, rotating past whatever the last strength day hit. */
export function nextStrengthFocus(workouts: Workout[]): StrengthFocus {
  const recent = [...workouts]
    .filter((w) => w.type === "strength")
    .sort((a, b) => (a.date < b.date ? 1 : -1));
  for (const workout of recent) {
    const focus = focusOfWorkout(workout);
    if (focus) {
      const idx = strengthFocusRotation.indexOf(focus);
      return strengthFocusRotation[(idx + 1) % strengthFocusRotation.length];
    }
  }
  return "squat";
}

/**
 * A 3–4 lift simple-progressive session: one main compound (squat/bench/
 * deadlift/OHP/row rotation), 1–2 secondaries, and a kettlebell-swing
 * finisher when a bell is on hand. Every line carries exact sets×reps×load
 * from the linear-progression rules above.
 */
export function buildProgressiveSession(
  profile: TrainingProfile,
  workouts: Workout[],
  focus?: StrengthFocus
): ProgressiveSession {
  const resolvedFocus = focus ?? nextStrengthFocus(workouts);
  const template = focusTemplate(resolvedFocus, profile);

  const picks: ExercisePick[] = [template.main, ...template.secondaries.slice(0, 2)];
  if (profile.equipment.kettlebells) {
    picks.push({ name: "Kettlebell Swing", opts: { sets: 3, targetReps: 15, maxReps: 20 } });
  }

  const prescriptions = picks.map((pick) =>
    getNextPrescription(pick.name, summarizeExerciseHistory(pick.name, workouts), pick.opts)
  );

  const main = prescriptions[0];
  const mainLoad = main.weightLbs ? ` @ ${main.weightLbs} lb` : "";
  const summary = `${FOCUS_LABEL[resolvedFocus]} day: ${main.exercise} ${main.sets}×${main.reps}${mainLoad} — add weight or reps every session, deload only after two misses.`;

  return {
    focus: resolvedFocus,
    title: `${FOCUS_LABEL[resolvedFocus]} day — simple progression`,
    prescriptions,
    summary,
    estMinutes: 45
  };
}

/** "Barbell Bench Press — 5×5 @ 185 lb" display line. */
export function formatPrescriptionLine(p: ExercisePrescription): string {
  const load = p.weightLbs ? ` @ ${p.weightLbs} lb` : "";
  return `${p.exercise} — ${p.sets}×${p.reps}${load}`;
}

/**
 * Per-exercise e1RM + last-session numbers for the AI prompt, covering the
 * lifts the progression engine would program today.
 */
export function buildProgressionContext(profile: TrainingProfile, workouts: Workout[]): string {
  const focus = nextStrengthFocus(workouts);
  const session = buildProgressiveSession(profile, workouts, focus);
  const lines = session.prescriptions.map((p) => {
    const history = summarizeExerciseHistory(p.exercise, workouts);
    const last = history[0];
    const e1Rm = bestRecentE1Rm(p.exercise, workouts);
    const lastText = last?.topWeightLbs
      ? `last session ${last.date}: top set ${last.topWeightLbs} lb${last.topReps ? ` × ${last.topReps}` : ""}`
      : "no logged sessions yet";
    const e1RmText = e1Rm ? `; best recent e1RM ~${e1Rm} lb` : "";
    return `- ${p.exercise}: ${lastText}${e1RmText}. Engine suggests: ${formatPrescriptionLine(p)}.`;
  });
  return [`Next focus in the rotation: ${FOCUS_LABEL[focus]}.`, ...lines].join("\n");
}
