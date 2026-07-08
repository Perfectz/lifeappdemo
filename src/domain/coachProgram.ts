import {
  bestRecentE1Rm,
  getNextPrescription,
  summarizeExerciseHistory,
  type ExercisePrescription
} from "@/domain/strengthProgression";
import type { TrainingProfile } from "@/domain/trainingProfile";
import type { Workout } from "@/domain/types";

/**
 * "Vinny split" — the user's real strength coach's programming, extracted from
 * docs/coaching/vinny-workouts.md. Two alternating days:
 *
 *   Day A "Chest and Bis":       Chest (3) → Tris (3) → Bis (3)
 *   Day B "Back and Shoulders":  Back (3) → Shoulders (3) → Traps (1)
 *
 * The FIRST exercise of the day is the main lift (incline/flat barbell bench
 * on A; rack/hex-bar/floor deadlifts on B): 1 warm-up, then 4 sets increasing
 * weight (triples). The progression target is the TOP triple — computed from
 * the training log via the linear-progression engine — with the lower rungs at
 * ~70/80/90% of the top, rounded to 5 lb. Accessories are mostly 3×10–12 and
 * ROTATE session-to-session; signature techniques (push-ups after chest sets,
 * Bulgarian bag swings, 21's, drop sets, "You Go, I Go", pre-exhaust) appear
 * deterministically every other same-day session — no randomness, so the same
 * log always produces the same session.
 */

export type VinnyDay = "A" | "B";

export type VinnySession = {
  day: VinnyDay;
  /** e.g. "Chest and Bis — Vinny split" (title doubles as the A/B marker in history). */
  title: string;
  prescriptions: ExercisePrescription[];
  /** One-line summary of where the main-lift progression stands. */
  summary: string;
  /** Coach's tip line for the session, when a signature technique is on. */
  tip?: string;
  estMinutes: number;
};

export const VINNY_DAY_NAME: Record<VinnyDay, string> = {
  A: "Chest and Bis",
  B: "Back and Shoulders"
};

/* ------------------------------------------------------------------ pools -- */

type PoolEntry = {
  name: string;
  sets: number;
  low: number;
  high: number;
  /** Requires cable/pulley/machine access (dropped without machines or a gym). */
  machine?: boolean;
};

const acc = (name: string, sets: number, low: number, high: number, machine = false): PoolEntry => ({
  name,
  sets,
  low,
  high,
  machine
});

/** Exercise names are verbatim from Vinny's emails (the workout archive). */
const DAY_A_MAINS = ["Incline Barbell Bench Press", "Flat Barbell Bench Press"];
const DAY_B_MAINS = ["Rack Deadlifts", "Hex Bar Deadlifts from the floor", "Deadlifts from the floor"];

const CHEST_POOL: PoolEntry[] = [
  acc("Flat Dumbbell Press", 3, 10, 12),
  acc("Pec Dec or Cable Crossover", 3, 10, 12, true),
  acc("Dumbbell Flat Fly's", 3, 10, 12),
  acc("Machine or Dumbbell Chest Press", 3, 10, 12),
  acc("Incline Dumbbell Fly's", 3, 8, 10),
  acc("Dumbbell Pull Overs", 3, 10, 12)
];

const TRIS_POOL: PoolEntry[] = [
  acc("Cable Push Downs", 3, 10, 12, true),
  acc("Skull Crushers", 3, 8, 10),
  acc("Tricep Pulley Pushdowns", 3, 15, 20, true),
  acc("Close Grip Flat Barbell Bench Press", 3, 8, 10),
  acc("Seated Tricep Extension Machine", 3, 10, 12, true),
  acc("Dip Machine or Bench Dips", 3, 10, 12),
  acc("Overhead Dumbbell Extensions", 3, 15, 20)
];

const BIS_POOL: PoolEntry[] = [
  acc("Dumbbell Hammer Curls", 3, 8, 10),
  acc("Preacher Curls", 3, 10, 12),
  acc("Low Pulley Straight Bar Curls", 3, 10, 12, true),
  acc("Dumbbell Curls", 3, 10, 12),
  acc("Single Arm High Cable Curls", 3, 10, 12, true)
];

const BACK_POOL: PoolEntry[] = [
  acc("Wide Grip Lat Pulldowns", 3, 10, 12, true),
  acc("Dumbbell Rows", 3, 10, 12),
  acc("Close Grip Lat Pulldowns", 3, 10, 12, true),
  acc("Machine Pulldowns or Machine Rows", 3, 10, 12, true),
  acc("Close Grip Low Pulley Rows", 3, 10, 12, true),
  acc("One Arm Hammer Strength Rows", 3, 10, 12, true)
];

const SHOULDER_PRESS_POOL: PoolEntry[] = [
  acc("Dumbbell Shoulder Press", 3, 10, 12),
  acc("Machine Shoulder Press", 3, 10, 12, true),
  acc("Standing Military Press", 3, 8, 10)
];

const LATERAL_POOL: PoolEntry[] = [
  acc("Lateral Raises (dumbbells or cables)", 3, 10, 12),
  acc("Machine Lateral Raise", 3, 10, 12, true),
  acc("Seated Lateral Raise Machine", 3, 12, 15, true)
];

const REAR_DELT_POOL: PoolEntry[] = [
  acc("Rear Delt Machine", 3, 10, 12, true),
  acc("Rear Delt Dumbbell Raises or Reverse Pec Deck", 3, 10, 12)
];

const SHOULDER_WARMUP_NOTE =
  "Warm up with 2 sets of light upright rows or hanging clean and press, 12–15 reps.";

/* ------------------------------------------------------------- techniques -- */

type VinnyTechnique =
  | "pushups"
  | "preacher_21s"
  | "drop_set"
  | "you_go_i_go"
  | "pre_exhaust"
  | "bulgarian_swings";

const DAY_A_TECHNIQUES: VinnyTechnique[] = [
  "pushups",
  "preacher_21s",
  "drop_set",
  "you_go_i_go",
  "pre_exhaust"
];
const DAY_B_TECHNIQUES: VinnyTechnique[] = ["bulgarian_swings"];

const TECHNIQUE_TIP: Record<VinnyTechnique, string> = {
  pushups: "Stay with 10 push-ups after each chest set even if 15 seems easy at first.",
  preacher_21s: "21's on the preachers: 7 bottom-half, 7 top-half, 7 full reps — light bar, big burn.",
  drop_set: "On the last pulley set: heavy 5–6 reps, strip to 8–10, strip again to failure.",
  you_go_i_go: "You Go, I Go: hand the bar back and forth 4 times — no rest until it's back in your hands.",
  pre_exhaust: "Something new — pre-exhaust the tris first, forcing more chest muscle on the presses.",
  bulgarian_swings: "Bulgarian bag swings after each set of back — 5 or 10 swings per side, active rest."
};

/* ---------------------------------------------------------- day detection -- */

const DAY_A_RE = /chest and (bis|arms)/i;
const DAY_B_RE = /back and shoulders/i;

/** Which Vinny day a logged strength session was, judging by its title. */
export function vinnyDayOfWorkout(workout: Workout): VinnyDay | undefined {
  if (workout.type !== "strength") return undefined;
  const title = workout.title ?? "";
  if (DAY_A_RE.test(title)) return "A";
  if (DAY_B_RE.test(title)) return "B";
  return undefined;
}

/** Alternate off the most recent Vinny strength session; start on Day A. */
export function nextVinnyDay(workouts: Workout[]): VinnyDay {
  const recent = workouts
    .filter((w) => w.type === "strength")
    .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
  for (const workout of recent) {
    const day = vinnyDayOfWorkout(workout);
    if (day) return day === "A" ? "B" : "A";
  }
  return "A";
}

/** How many Vinny sessions of this day are already in the log (rotation seed). */
function priorSameDayCount(workouts: Workout[], day: VinnyDay): number {
  return workouts.filter((w) => vinnyDayOfWorkout(w) === day).length;
}

/* --------------------------------------------------------------- helpers -- */

function roundTo5(value: number): number {
  return Math.round(value / 5) * 5;
}

/** The 4 ascending working triples: ~70/80/90/100% of the top, rounded to 5. */
export function trippleLadderLbs(topTripleLbs: number): number[] {
  return [0.7, 0.8, 0.9, 1].map((f) => Math.max(roundTo5(topTripleLbs * f), 5));
}

function rotatePicks(pool: PoolEntry[], count: number, seed: number): PoolEntry[] {
  if (pool.length === 0) return [];
  const picks: PoolEntry[] = [];
  for (let i = 0; i < count && i < pool.length; i++) {
    picks.push(pool[(seed + i) % pool.length]);
  }
  return picks;
}

function filterPool(pool: PoolEntry[], profile: TrainingProfile): PoolEntry[] {
  const machinesOk = profile.equipment.machines || profile.gymAccess;
  if (machinesOk) return pool;
  const filtered = pool.filter((e) => !e.machine);
  return filtered.length > 0 ? filtered : pool;
}

/**
 * Main lift: 1 warm-up + 4 ascending triples. Top triple comes from the
 * linear-progression engine (all triples completed → +5 upper / +10 deadlift
 * via classifyExercise/progressionIncrementLbs; missed → repeat; two misses →
 * deload 10%), then the ladder fills in the lower rungs.
 */
function buildMainLift(name: string, workouts: Workout[], group: string): ExercisePrescription {
  const next = getNextPrescription(name, summarizeExerciseHistory(name, workouts), {
    sets: 4,
    targetReps: 3
  });
  const top = next.weightLbs !== undefined ? Math.max(roundTo5(next.weightLbs), 5) : undefined;
  const ladder = top !== undefined ? trippleLadderLbs(top) : undefined;
  const e1Rm = bestRecentE1Rm(name, workouts);
  const scheme = ladder
    ? `1 warm-up, then 4 sets increasing weight — triples: ${ladder.join("/")}`
    : "1 warm-up, then 4 sets increasing weight (triples) — work up to a solid top triple";
  const note =
    e1Rm && next.note ? `${next.note} Best recent e1RM ~${e1Rm} lb.` : next.note;
  return { exercise: name, sets: 4, reps: 3, weightLbs: top, group, scheme, note };
}

/** Accessory: fixed scheme from the archive, load + coach note from the log. */
function buildAccessory(entry: PoolEntry, workouts: Workout[], group: string): ExercisePrescription {
  const scheme = `${entry.sets} sets of ${entry.low}–${entry.high}`;
  const history = summarizeExerciseHistory(entry.name, workouts);
  if (history.length === 0) {
    return { exercise: entry.name, sets: entry.sets, reps: entry.high, group, scheme };
  }
  const next = getNextPrescription(entry.name, history, {
    sets: entry.sets,
    targetReps: entry.low
  });
  return {
    exercise: entry.name,
    sets: entry.sets,
    reps: entry.high,
    weightLbs: next.weightLbs,
    note: next.note,
    group,
    scheme
  };
}

function appendScheme(p: ExercisePrescription, extra: string): ExercisePrescription {
  return { ...p, scheme: p.scheme ? `${p.scheme}; ${extra}` : extra };
}

/* --------------------------------------------------------------- sessions -- */

export type VinnySessionInput = {
  profile: TrainingProfile;
  /** Logged workout history (the progression + rotation source of truth). */
  workouts: Workout[];
  /** Override the A/B alternation (otherwise derived from history). */
  focusDay?: VinnyDay;
};

export function buildVinnySession({ profile, workouts, focusDay }: VinnySessionInput): VinnySession {
  const day = focusDay ?? nextVinnyDay(workouts);
  const seed = priorSameDayCount(workouts, day);

  // Signature technique every other same-day session, rotating through the
  // day's list — deterministic, so re-computing today's plan never flips it.
  const techniques = day === "A" ? DAY_A_TECHNIQUES : DAY_B_TECHNIQUES;
  const technique: VinnyTechnique | undefined =
    seed % 2 === 1 ? techniques[Math.floor(seed / 2) % techniques.length] : undefined;
  const tip = technique ? TECHNIQUE_TIP[technique] : undefined;

  const prescriptions =
    day === "A"
      ? buildDayA(profile, workouts, seed, technique)
      : buildDayB(profile, workouts, seed, technique);

  const main = prescriptions.find((p) => p.reps === 3 && p.sets === 4) ?? prescriptions[0];
  const summary = main.weightLbs
    ? `Day ${day} — ${VINNY_DAY_NAME[day]}: ${main.exercise} top triple ${main.weightLbs} lb, then rotate the accessories.`
    : `Day ${day} — ${VINNY_DAY_NAME[day]}: ${main.exercise} — work up to a solid top triple, then the accessories.`;

  return {
    day,
    title: `${VINNY_DAY_NAME[day]} — Vinny split`,
    prescriptions,
    summary,
    tip,
    estMinutes: 60
  };
}

function buildDayA(
  profile: TrainingProfile,
  workouts: Workout[],
  seed: number,
  technique: VinnyTechnique | undefined
): ExercisePrescription[] {
  const main = buildMainLift(DAY_A_MAINS[seed % DAY_A_MAINS.length], workouts, "Chest");
  let chest = [
    main,
    ...rotatePicks(filterPool(CHEST_POOL, profile), 2, seed).map((e) =>
      buildAccessory(e, workouts, "Chest")
    )
  ];

  let trisPicks = rotatePicks(filterPool(TRIS_POOL, profile), 3, seed);
  if (technique === "drop_set" && !trisPicks.some((e) => /pulley|cable/i.test(e.name))) {
    trisPicks = [...trisPicks.slice(0, 2), acc("Tricep Pulley Pushdowns", 3, 15, 20, true)];
  }
  let tris = trisPicks.map((e) => buildAccessory(e, workouts, "Tris"));

  let bis: ExercisePrescription[] = [
    {
      ...buildAccessory(acc("Barbell Curls", 3, 10, 12), workouts, "Bis"),
      scheme: "1 warm-up, then 3 sets of 10–12"
    },
    ...rotatePicks(
      filterPool(
        BIS_POOL.filter((e) => e.name !== "Barbell Curls"),
        profile
      ),
      2,
      seed
    ).map((e) => buildAccessory(e, workouts, "Bis"))
  ];

  // One signature technique at a time.
  if (technique === "pushups") {
    chest = chest.map((p) => appendScheme(p, "5–15 push-ups after each set"));
  } else if (technique === "preacher_21s") {
    bis = [
      bis[0],
      ...bis.slice(1).filter((p) => p.exercise !== "Preacher Curls").slice(0, 1),
      { exercise: "Preacher Curls", sets: 3, reps: 21, group: "Bis", scheme: "3 sets of 21's" }
    ];
  } else if (technique === "drop_set") {
    tris = tris.map((p, i) =>
      i === tris.length - 1 || /pulley|cable/i.test(p.exercise)
        ? appendScheme(p, "last set a drop set (heavy 5–6, lighter 8–10, lighter to failure)")
        : p
    );
  } else if (technique === "you_go_i_go") {
    bis = [
      {
        exercise: '"You Go, I Go" Barbell Curls',
        sets: 4,
        reps: 10,
        group: "Bis",
        scheme: "hand it back and forth 4 times"
      },
      ...bis.slice(1)
    ];
  }

  // Rare pre-exhaust day: tris before chest.
  return technique === "pre_exhaust" ? [...tris, ...chest, ...bis] : [...chest, ...tris, ...bis];
}

function buildDayB(
  profile: TrainingProfile,
  workouts: Workout[],
  seed: number,
  technique: VinnyTechnique | undefined
): ExercisePrescription[] {
  const main = buildMainLift(DAY_B_MAINS[seed % DAY_B_MAINS.length], workouts, "Back");
  let back = [
    main,
    ...rotatePicks(filterPool(BACK_POOL, profile), 2, seed).map((e) =>
      buildAccessory(e, workouts, "Back")
    )
  ];

  if (technique === "bulgarian_swings") {
    back = back.map((p) => appendScheme(p, "Bulgarian bag swings between sets — 5–10 per side"));
  }

  const shoulderPick = (pool: PoolEntry[]): ExercisePrescription =>
    buildAccessory(rotatePicks(filterPool(pool, profile), 1, seed)[0], workouts, "Shoulders");
  const press = shoulderPick(SHOULDER_PRESS_POOL);
  const shoulders = [
    { ...press, note: press.note ? `${SHOULDER_WARMUP_NOTE} ${press.note}` : SHOULDER_WARMUP_NOTE },
    shoulderPick(LATERAL_POOL),
    shoulderPick(REAR_DELT_POOL)
  ];

  const traps = [buildAccessory(acc("Barbell or Dumbbell Shrugs", 3, 10, 12), workouts, "Traps")];

  return [...back, ...shoulders, ...traps];
}

/* -------------------------------------------------------------- rendering -- */

/**
 * Scheme text with the load woven in after the first scheme segment (so a
 * technique suffix like "; 5–15 push-ups after each set" stays at the end),
 * e.g. "3 sets of 10–12 @ 70 lb; Bulgarian bag swings between sets".
 * Ladder schemes already spell out the weights, so no suffix is added.
 */
export function formatPrescriptionScheme(p: ExercisePrescription): string {
  const base = p.scheme ?? `${p.sets}×${p.reps}`;
  const showWeight =
    typeof p.weightLbs === "number" && !(p.scheme ?? "").includes(String(p.weightLbs));
  if (!showWeight) return base;
  const [first, ...rest] = base.split("; ");
  return [`${first} @ ${p.weightLbs} lb`, ...rest].join("; ");
}

/** "Chest · Incline Barbell Bench Press — 1 warm-up, then 4 sets…" display line. */
export function formatVinnyPrescriptionLine(p: ExercisePrescription): string {
  return `${p.group ? `${p.group} · ` : ""}${p.exercise} — ${formatPrescriptionScheme(p)}`;
}

/* -------------------------------------------------------------- AI prompt -- */

/**
 * Per-exercise last-session numbers + the engine's exact Vinny prescription —
 * the ground truth the AI coach must not contradict.
 */
export function buildVinnyProgressionContext(profile: TrainingProfile, workouts: Workout[]): string {
  const session = buildVinnySession({ profile, workouts });
  const lines = session.prescriptions.map((p) => {
    const last = summarizeExerciseHistory(p.exercise, workouts)[0];
    const lastText = last?.topWeightLbs
      ? `last session ${last.date}: top set ${last.topWeightLbs} lb${last.topReps ? ` × ${last.topReps}` : ""}`
      : "no logged sessions yet";
    return `- ${formatVinnyPrescriptionLine(p)} (${lastText})`;
  });
  return [
    `Next session in the Vinny split: Day ${session.day} — ${VINNY_DAY_NAME[session.day]}.`,
    session.tip ? `Signature technique / coach tip queued for today: ${session.tip}` : "",
    ...lines
  ]
    .filter(Boolean)
    .join("\n");
}

/** Format description the AI must follow when the coach style is vinny_split. */
export const vinnyStyleGuide = [
  "COACH STYLE GUIDE — VINNY SPLIT (follow this format exactly):",
  'Two alternating days. Day A "Chest and Bis": Chest (3 exercises) → Tris (3) → Bis (3). Day B "Back and Shoulders": Back (3) → Shoulders (3, warm up with 2 light sets of upright rows or hanging clean and press, 12–15 reps) → Traps (1).',
  "The FIRST exercise is the main lift (incline/flat barbell bench press on A; rack/hex-bar/floor deadlifts on B): 1 warm-up, then 4 sets increasing weight (Triples). The lower rungs sit at ~70/80/90% of the top triple, rounded to 5 lb.",
  "Accessories are mostly 3 sets of 10–12 (some 8–10; pulley work 15–20) and the exercise selection ROTATES session to session — don't repeat the previous session's accessories.",
  'Occasionally (every 2nd–3rd session, ONE at a time) add a signature technique: 5–15 push-ups after each chest set; Bulgarian bag swings between back sets; preacher curl 21\'s; a drop set on the last pulley set; "You Go, I Go" barbell curls; or a rare pre-exhaust day (tris before chest). When you use one, open the session with a one-line coach tip in the strength item\'s description.',
  "In every strength prescription set 'group' to the muscle-group header (Chest/Tris/Bis or Back/Shoulders/Traps) and 'scheme' to the set-scheme text (e.g. \"1 warm-up, then 4 sets increasing weight — triples: 135/155/175/185\" or \"3 sets of 10–12\")."
].join("\n");

/** Two real sessions quoted from the coach's archive (style few-shots). */
export const vinnyFewShotExamples = [
  "EXAMPLE SESSION (Day A — Chest and Bis):",
  "Chest",
  "1. Incline Barbell Bench Press — 1 warm up, then 4 sets increasing weight (Triples)",
  "2. Flat Dumbbell Press — 3 sets of 10–12 reps",
  "3. Pec Dec or Cable Crossover — 3 sets of 10–12 reps",
  "Tris",
  "1. Cable Push Downs — 4 sets of 10–12 reps, increasing weight as you warm up",
  "2. Skull Crushers — 3 sets of 8–10 reps",
  "3. Seated Tricep Extension Machine — 3 sets of 10–12 reps",
  "Bis",
  "1. Barbell Curls — 1 warm up, then 3 sets of 10–12 reps",
  "2. Dumbbell Hammer Curls — 3 sets of 8–10 reps",
  "3. Preacher Curls — 3 sets of 21's",
  "",
  "EXAMPLE SESSION (Day B — Back and Shoulders; note: Bulgarian Bag swings after each set of Back — 5 or 10 swings per side):",
  "Back",
  "1. Hex Bar Deadlifts from the floor — 1 warm up, then 4 sets increasing weight (Triples)",
  "2. Dumbbell Rows — 3 sets of 10–12 reps",
  "3. Close Grip Lat Pulldowns — 3 sets of 10–12 reps",
  "Shoulders (warm up with 2 sets of upright rows, 12–15 reps)",
  "1. Machine Shoulder Press (or dumbbell shoulder press if taken) — 3 sets of 10–12 reps",
  "2. Seated Lateral Raise Machine — 3 sets of 12–15 reps",
  "3. Rear Delt Machine or Dumbbell Raises — 3 sets of 10–12 reps",
  "Traps",
  "1. Barbell or Dumbbell Shrugs — 2 sets of 8–10 reps"
].join("\n");
