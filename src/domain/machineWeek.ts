import { formatVinnyPrescriptionLine } from "@/domain/coachProgram";
import { toLocalIsoDate } from "@/domain/dates";
import {
  epleyE1Rm,
  normalizeExerciseName,
  type ExercisePrescription,
  type ExerciseSession
} from "@/domain/strengthProgression";
import type { TrainingProfile } from "@/domain/trainingProfile";
import type { IsoDate, Workout } from "@/domain/types";

/**
 * "Planet Fitness machine week" — port of the Android app's `MachineWeek.kt`
 * (the source of truth; keep the two in step). Seven different 45-minute
 * strength sessions, one per weekday, built only from pin-stack machines,
 * cable stations and the assisted dip/chin — no dumbbells, barbells,
 * kettlebells or Smith machine.
 *
 *   Mon Push A · Tue Pull A · Wed Legs A · Thu Push B · Fri Pull B · Sat Legs B · Sun light full body
 *
 * Every major muscle gets two hard sessions a week with 48–72 h between them;
 * Sunday is a light full-body day in straight sets. Loads use double
 * progression: stay on a pin until every set reaches the top of the rep range,
 * then move up one pin (assisted machines go the other way: one pin LESS
 * help). Deterministic — the same date and log always produce the same session.
 *
 * Plan items keep the Android JSON shape (presetId "machine-week:MONDAY",
 * variant "Machine", prescriptions with group + scheme) so plans synced between
 * the app and the web stay compatible.
 */

/* ------------------------------------------------------------------ types -- */

/** How a machine progresses: pin jump size and direction. */
export const machineLoads = ["Standard", "LegPress", "Small", "Assisted"] as const;
export type MachineLoad = (typeof machineLoads)[number];

/**
 * Pin jump per load kind (lb). Standard: most pin stacks (presses, pulldowns,
 * rows, leg extension/curl, hips, abs, back). LegPress: leg press and other big
 * lower-body stacks. Small: small muscles and cables (curls, pushdowns, flys,
 * raises, kickbacks). Assisted: dip / chin assist — the stack is HELP, so
 * progress means less weight.
 */
export const MACHINE_LOAD_STEP_LBS: Record<MachineLoad, number> = {
  Standard: 10,
  LegPress: 20,
  Small: 5,
  Assisted: 10
};

/** One YouTube how-to video, checked to be playable and to show this exact exercise. */
export type HowToVideo = { id: string; startSec: number };

/** "https://www.youtube.com/watch?v=ID", plus "&t=Ns" to jump to the start time. */
export function howToVideoUrl(video: HowToVideo): string {
  return `https://www.youtube.com/watch?v=${video.id}${video.startSec > 0 ? `&t=${video.startSec}s` : ""}`;
}

/** One machine on the gym floor: how to set it up, what to feel, what to use when it's taken. */
export type GymMachine = {
  /** Logged exercise name. Unique: no machine name contains another. */
  name: string;
  load: MachineLoad;
  setup: string;
  cues: string;
  mistake: string;
  /** Machine-only alternatives for when it's busy. */
  swaps: string[];
  videoQuery: string;
  /** Done one side at a time (left then right = one set): twice the work time. */
  unilateral: boolean;
  /** A checked how-to video on YouTube; undefined falls back to a YouTube search. */
  video?: HowToVideo;
  /** "Watch how" link: the checked video (jumping to its start time), else a YouTube search. */
  videoUrl: string;
  /** Logger instructions: setup → form → the mistake to avoid → swaps. */
  instructions: string;
};

/** java.time.DayOfWeek names — the suffix of a machine-week plan id ("machine-week:MONDAY"). */
export const weekdays = [
  "MONDAY",
  "TUESDAY",
  "WEDNESDAY",
  "THURSDAY",
  "FRIDAY",
  "SATURDAY",
  "SUNDAY"
] as const;
export type Weekday = (typeof weekdays)[number];

const WEEKDAY_NAME: Record<Weekday, string> = {
  MONDAY: "Monday",
  TUESDAY: "Tuesday",
  WEDNESDAY: "Wednesday",
  THURSDAY: "Thursday",
  FRIDAY: "Friday",
  SATURDAY: "Saturday",
  SUNDAY: "Sunday"
};

/** "Monday" (DayOfWeek display name, FULL). */
export function weekdayName(weekday: Weekday): string {
  return WEEKDAY_NAME[weekday];
}

/** "Mon" (DayOfWeek display name, SHORT). */
function weekdayShortName(weekday: Weekday): string {
  return WEEKDAY_NAME[weekday].slice(0, 3);
}

/** The weekday [days] after [weekday], wrapping Sunday → Monday (DayOfWeek.plus). */
export function plusWeekdays(weekday: Weekday, days: number): Weekday {
  const n = weekdays.length;
  return weekdays[(((weekdays.indexOf(weekday) + days) % n) + n) % n];
}

/** One exercise slot in a day: machine, muscle label, sets × rep range, rest. */
export type MachineSlot = {
  machine: string;
  group: string;
  sets: number;
  low: number;
  high: number;
  restSec: number;
  /** Alternate with the next slot (A1/A2): one shared rest after each pair. */
  supersetWithNext: boolean;
  /** Superset only: seconds to get from A to B (15 on one cable station, 30 to a neighboring machine). */
  switchSec: number;
  /** Light-day effort override: undefined = follow the day; false = normal effort even on the light day. */
  easy?: boolean;
  note?: string;
};

export type MachineDay = {
  weekday: Weekday;
  name: string;
  focus: string;
  warmup: string;
  slots: MachineSlot[];
  /** Lighter full-body day (higher reps, shorter rest): allowed the day after a hard day. */
  light: boolean;
};

export type MachineSession = {
  day: MachineDay;
  /** True when this isn't the calendar day's session (the user swapped). */
  swapped: boolean;
  title: string;
  prescriptions: ExercisePrescription[];
  summary: string;
  tip: string;
  estMinutes: number;
};

/* ----------------------------------------------------------- timing model -- */

/** Seconds per working set of 8–15 reps (~3 s each). One-side-at-a-time moves take twice as long. */
const WORK_SECONDS = 45;
/** Seconds per 12–20-rep set (abs, obliques, calves). */
const LONG_WORK_SECONDS = 60;
/** Walk to the machine, set seat / pads / pin, wipe down. Counted for every station, including the first. */
const SETUP_SECONDS = 60;
/** Warm-up: 2 light ramp sets on the day's first machine. */
const WARMUP_SECONDS = 180;

function workSeconds(slot: MachineSlot): number {
  const one = slot.high >= 20 ? LONG_WORK_SECONDS : WORK_SECONDS;
  return find(slot.machine)?.unilateral === true ? 2 * one : one;
}

/**
 * Minutes for a day: warm-up + each block. Straight sets: setup + sets × (work + rest).
 * Superset pair (A1/A2): two setups + rounds × (work A + switch + work B + shared rest), where the
 * switch is 15 s on one cable station or 30 s to a neighboring machine.
 * Waiting for a busy machine isn't included: use the swap instead of waiting.
 */
function estimateMinutes(day: MachineDay): number {
  let seconds = WARMUP_SECONDS;
  const slots = day.slots;
  let i = 0;
  while (i < slots.length) {
    const a = slots[i];
    const b = slots[i + 1] as MachineSlot | undefined;
    if (a.supersetWithNext && b !== undefined) {
      const rounds = Math.max(a.sets, b.sets);
      seconds +=
        2 * SETUP_SECONDS +
        rounds * (workSeconds(a) + a.switchSec + workSeconds(b) + Math.max(a.restSec, b.restSec));
      i += 2;
    } else {
      seconds += SETUP_SECONDS + a.sets * (workSeconds(a) + a.restSec);
      i += 1;
    }
  }
  return Math.round(seconds / 60);
}

/** Hard working sets per muscle label across the week (warm-ups excluded). */
function weeklySets(): Record<string, number> {
  const totals: Record<string, number> = {};
  for (const slot of DAYS.flatMap((d) => d.slots)) {
    totals[slot.group] = (totals[slot.group] ?? 0) + slot.sets;
  }
  return totals;
}

/* ---------------------------------------------------------------- lookups -- */

let byKey: Map<string, GymMachine> | undefined;

/** The machine for a logged exercise name (exact, after normalizing). */
function find(name: string): GymMachine | undefined {
  byKey ??= new Map(MACHINES.map((m) => [normalizeExerciseName(m.name), m]));
  return byKey.get(normalizeExerciseName(name));
}

function day(weekday: Weekday): MachineDay {
  return DAYS.find((d) => d.weekday === weekday) ?? DAYS[0];
}

/** Calendar weekday of an ISO date (first 10 chars, "YYYY-MM-DD"); undefined when it isn't a real date. */
function parseWeekday(date: string | undefined): Weekday | undefined {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec((date ?? "").slice(0, 10));
  if (!m) return undefined;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const utc = new Date(Date.UTC(y, mo - 1, d));
  // Reject rollovers like 2026-02-30 (LocalDate.parse would throw).
  if (utc.getUTCFullYear() !== y || utc.getUTCMonth() !== mo - 1 || utc.getUTCDate() !== d) {
    return undefined;
  }
  // getUTCDay: 0 = Sunday … 6 = Saturday → DayOfWeek order (Monday first).
  return weekdays[(utc.getUTCDay() + 6) % 7];
}

/** The session for a local ISO date's weekday (today's when the date doesn't parse). */
function dayFor(date: IsoDate): MachineDay {
  return day(parseWeekday(date) ?? parseWeekday(toLocalIsoDate()) ?? "MONDAY");
}

const PLAN_PREFIX = "machine-week:";

/** Plan-item id that marks a strength suggestion as a machine-week day ("machine-week:MONDAY"). */
function planId(weekday: Weekday): string {
  return `${PLAN_PREFIX}${weekday}`;
}

function weekdayOf(id: string | null | undefined): Weekday | undefined {
  if (!id || !id.startsWith(PLAN_PREFIX)) return undefined;
  const name = id.slice(PLAN_PREFIX.length);
  return weekdays.find((w) => w === name);
}

function isMachineWeek(item: { presetId?: string } | null | undefined): boolean {
  return weekdayOf(item?.presetId) !== undefined;
}

/* ------------------------------------------------------------ progression -- */

function roundTo(value: number, step: number): number {
  return Math.round(value / step) * step;
}

/** Pound display matching the Android `StrengthMath.lbs` (≤ 2 decimals): 185 → "185", 187.5 → "187.5". */
function lbs(weight: number): string {
  return String(Math.round(weight * 100) / 100);
}

/**
 * One past session on a machine: the working pin and the reps of every set done at it.
 * The working pin is the heaviest weight used — on assisted machines, where the stack is
 * help, it's the LEAST help.
 */
type PinSession = {
  date: IsoDate;
  weight: number;
  /** Reps of every set at the pin (lighter warm-up / drop sets don't count, wherever they were logged). */
  reps: number[];
  assisted: boolean;
};

const minReps = (s: PinSession): number => Math.min(...s.reps);
const maxReps = (s: PinSession): number => Math.max(...s.reps);

/**
 * Past sessions on [machine], newest first. Exact name match only (after normalizing), so a
 * free-weight "Overhead Triceps Extension" or "45° Back Extension" from another plan never becomes a pin.
 * With [hardOnly], sessions where this machine was easy on the light day are left out.
 */
function pinHistory(machine: string, load: MachineLoad, workouts: Workout[], hardOnly: boolean): PinSession[] {
  const key = normalizeExerciseName(machine);
  const assisted = load === "Assisted";
  // Two logs on one day (the session saved, then reopened for the last sets) are one session.
  const byDate = new Map<IsoDate, Workout[]>();
  for (const w of workouts) {
    if (w.type !== "strength" || (hardOnly && isLightSession(w, machine))) continue;
    const sameDay = byDate.get(w.date);
    if (sameDay) sameDay.push(w);
    else byDate.set(w.date, [w]);
  }
  const sessions: PinSession[] = [];
  for (const [date, sameDay] of byDate) {
    const sets = [...sameDay]
      .sort((a, b) => (a.recordedAt < b.recordedAt ? -1 : a.recordedAt > b.recordedAt ? 1 : 0))
      .flatMap((w) =>
        (w.sets ?? []).filter(
          (s) => normalizeExerciseName(s.exercise) === key && (s.reps ?? 0) > 0 && (s.weightLbs ?? 0) > 0
        )
      );
    if (sets.length === 0) continue;
    const weights = sets.map((s) => s.weightLbs as number);
    const pin = assisted ? Math.min(...weights) : Math.max(...weights);
    sessions.push({
      date,
      weight: pin,
      reps: sets.filter((s) => s.weightLbs === pin).map((s) => s.reps as number),
      assisted
    });
  }
  // Newest first (Kotlin sortedByDescending; dates are unique after the merge).
  return sessions.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
}

/**
 * The logger's "Last" line and best e1RM for a machine: same exact-name history as the
 * prescription (never a free-weight look-alike). Assisted machines get no e1RM: more help
 * is not a stronger lift.
 */
function loggerHistory(machine: string, workouts: Workout[]): ExerciseSession[] {
  const load = find(machine)?.load ?? "Standard";
  return pinHistory(machine, load, workouts, false).map((s) => ({
    date: s.date,
    topWeightLbs: s.weight,
    topReps: maxReps(s),
    setCount: s.reps.length,
    e1Rm: s.assisted ? undefined : Math.round(epleyE1Rm(s.weight, maxReps(s)))
  }));
}

/** Assisted machines (the stack is help): weight and e1RM records don't apply. */
function isAssisted(exercise: string): boolean {
  return find(exercise)?.load === "Assisted";
}

/** The session before last was at the same pin and also fell short of the range on every set. */
function missedTwice(history: PinSession[], low: number): boolean {
  const last = history[0];
  const prev = history[1];
  if (!last || !prev) return false;
  return prev.weight === last.weight && maxReps(prev) < low;
}

/**
 * Double progression for a pin-stack machine. Every set at the pin reached the top of the
 * range last time → one pin up (assisted: one pin less help) and reset to the bottom; even the
 * best set below the bottom twice at the same pin → one pin easier; otherwise same pin, one
 * more rep on the weakest set.
 */
function prescribe(slot: MachineSlot, workouts: Workout[], light = false): ExercisePrescription {
  const machine = find(slot.machine);
  const load: MachineLoad = machine?.load ?? "Standard";
  if (light) return prescribeLight(slot, load, workouts);
  // Light-day sets are deliberately easy: they never count toward moving up a pin.
  const history = pinHistory(slot.machine, load, workouts, true);
  const last = history[0] as PinSession | undefined;
  const step = MACHINE_LOAD_STEP_LBS[load];
  const assisted = load === "Assisted";
  const range = `${slot.low}–${slot.high}`;
  const swap = machine?.swaps[0];

  let reps: number;
  let weight: number | undefined;
  let coach: string;
  if (!last) {
    reps = slot.high;
    weight = undefined;
    coach = assisted
      ? `First time: pick enough help to get ${range} clean reps; we'll take help away as you get stronger.`
      : "First time: pick a pin you could lift 2–3 more times at the end of each set. Log the weight.";
  } else if (minReps(last) >= slot.high && last.reps.length >= slot.sets) {
    const w = last.weight;
    const hit = last.reps.length > 1 ? "every set" : `${maxReps(last)} reps`;
    if (!assisted) {
      const next = roundTo(w + step, 5);
      [reps, weight] = [slot.low, next];
      coach = `Hit ${hit} at ${lbs(w)} lb (top of ${range}) — move up one pin (~${lbs(next)} lb) and build back to ${slot.high}.`;
    } else if (w - step >= step) {
      const next = roundTo(w - step, 5);
      [reps, weight] = [slot.low, next];
      coach = `Hit ${hit} with ${lbs(w)} lb of help — take one pin less help (${lbs(next)} lb) and build back to ${slot.high}.`;
    } else {
      // Already on the lightest help: never prescribe 0 lb (the logger saves 0 as "no weight").
      [reps, weight] = [slot.high, w];
      coach = `On the lightest help (${lbs(w)} lb) and hitting ${range} — finish each set with 1–3 reps unassisted.`;
    }
  } else if (maxReps(last) < slot.low && missedTwice(history, slot.low)) {
    const w = last.weight;
    if (assisted) {
      const next = roundTo(w + step, 5);
      [reps, weight] = [slot.high, next];
      coach = `Two tough sessions with ${lbs(w)} lb of help — add one pin of help (${lbs(next)} lb) and own ${range}.`;
    } else if (w - step >= step) {
      const next = roundTo(w - step, 5);
      [reps, weight] = [slot.high, next];
      coach = `Two tough sessions at ${lbs(w)} lb — go one pin easier (${lbs(next)} lb) and own ${range}.`;
    } else {
      [reps, weight] = [slot.low, w];
      coach = `Already on the lightest pin (${lbs(w)} lb) — aim for ${slot.low} reps${swap ? `, or use the ${swap}` : ""}.`;
    }
  } else if (maxReps(last) < slot.low) {
    [reps, weight] = [slot.low, last.weight];
    coach = `Got ${maxReps(last)} at ${lbs(last.weight)} lb — stay on that pin and get to ${slot.low}.`;
  } else {
    const target = Math.min(Math.max(minReps(last) + 1, slot.low), slot.high);
    const did = last.reps.join("/");
    [reps, weight] = [target, last.weight];
    coach =
      minReps(last) >= slot.high
        ? `Did ${did} at ${lbs(last.weight)} lb — same pin; do all ${slot.sets} sets at ${lbs(last.weight)} lb with ${slot.high} reps before moving up.`
        : maxReps(last) >= slot.high
          ? `Did ${did} at ${lbs(last.weight)} lb — same pin; get every set to ${slot.high} before moving up.`
          : `Did ${did} at ${lbs(last.weight)} lb — same pin, aim for ${target} on every set.`;
  }
  return {
    exercise: slot.machine,
    sets: slot.sets,
    reps,
    weightLbs: weight,
    note: [slot.note, coach].filter(Boolean).join(" "),
    group: slot.group,
    scheme: scheme(slot, weight)
  };
}

/** Light day: ~80% of the last hard-day pin (rounded to a real pin), no progression, stop well short of failure. */
function prescribeLight(slot: MachineSlot, load: MachineLoad, workouts: Workout[]): ExercisePrescription {
  const hard = pinHistory(slot.machine, load, workouts, true)[0]?.weight as number | undefined;
  const any = hard ?? (pinHistory(slot.machine, load, workouts, false)[0]?.weight as number | undefined);
  const step = MACHINE_LOAD_STEP_LBS[load];
  let weight: number | undefined;
  if (any !== undefined) {
    if (hard === undefined) weight = any;
    else if (load === "Assisted") weight = Math.max(roundTo(any * 1.2, step), any + step);
    else weight = Math.min(Math.max(roundTo(any * 0.8, step), step), any);
  }
  const coach =
    hard !== undefined && weight !== undefined && load === "Assisted"
      ? `Light day: a bit more help than usual (${lbs(weight)} lb); stop with 3–4 reps left.`
      : hard !== undefined && weight !== undefined
        ? `Light day: about 80% of your usual pin (${lbs(weight)} lb); stop with 3–4 reps left.`
        : "Light day: an easy pin you could lift 3–4 more times.";
  return {
    exercise: slot.machine,
    sets: slot.sets,
    reps: slot.high,
    weightLbs: weight,
    note: [slot.note, coach].filter(Boolean).join(" "),
    group: slot.group,
    scheme: scheme(slot, weight)
  };
}

/**
 * Without [machine]: a logged session from the light day (titles carry the day name).
 * With [machine]: that machine was done at light-day effort in [w] — the session is from the
 * light day and the machine isn't one of that day's normal-effort slots. Sunday's calves and
 * woodchops still count toward progression; everything else logged that day (swaps included)
 * is easy work.
 */
function isLightSession(w: Workout, machine?: string): boolean {
  const title = w.title?.toLowerCase();
  if (title === undefined) return false;
  if (machine === undefined) return DAYS.some((d) => d.light && title.includes(d.name.toLowerCase()));
  const key = normalizeExerciseName(machine);
  return DAYS.some(
    (d) =>
      d.light &&
      title.includes(d.name.toLowerCase()) &&
      !d.slots.some((s) => normalizeExerciseName(s.machine) === key && s.easy === false)
  );
}

/** "3 sets of 10–12 @ 60 lb; rest 75 s; superset: go straight to the next machine". */
function scheme(slot: MachineSlot, weightLbs?: number): string {
  const parts = [
    `${slot.sets} sets of ${slot.low}–${slot.high}${typeof weightLbs === "number" ? ` @ ${lbs(weightLbs)} lb` : ""}`,
    `rest ${slot.restSec} s`
  ];
  if (slot.supersetWithNext) parts.push("superset: go straight to the next machine");
  return parts.join("; ");
}

/* ---------------------------------------------------------------- session -- */

/**
 * Today's session (or [weekday]'s, when the user swapped days). [profile] is accepted for
 * parity with the Android signature; the machine week doesn't depend on it.
 */
function buildSession(
  profile: TrainingProfile | undefined,
  workouts: Workout[],
  date: IsoDate,
  weekday?: Weekday
): MachineSession {
  const calendar = dayFor(date);
  const today = weekday ? day(weekday) : calendar;
  const swapped = today.weekday !== calendar.weekday;
  const prescriptions = today.slots.map((s) => prescribe(s, workouts, s.easy ?? today.light));
  const minutes = estimateMinutes(today);
  const ready = prescriptions.filter((p) => p.weightLbs !== undefined).length;
  const name = weekdayName(today.weekday);
  const workingSets = today.slots.reduce((n, s) => n + s.sets, 0);
  const summary =
    `${name} · ${today.name}: ${prescriptions.length} machines, ${workingSets} working sets, about ${minutes} min.` +
    (ready === 0
      ? " First run — log each pin so the app can move you up."
      : " Weights come from your log; move up a pin when every set hits the top of the range.");
  return {
    day: today,
    swapped,
    title: swapped ? `${name}'s ${today.name} (swapped in)` : `${name} · ${today.name}`,
    prescriptions,
    summary,
    tip: today.light
      ? `Warm-up: ${today.warmup} Light day: end every set with 3–4 good reps left so you start Monday fresh.`
      : `Warm-up: ${today.warmup} Stop each set with 1–2 good reps left (the last set on a machine can go to 0–1). Machine taken? Use its swap instead of waiting. Past 45 min? Drop the last round of the final superset.`,
    estMinutes: minutes
  };
}

/** "Chest · Seated Chest Press — 3 sets of 10–12 @ 120 lb; rest 90 s" (the Vinny line format). */
function formatLine(p: ExercisePrescription): string {
  return formatVinnyPrescriptionLine(p);
}

/** Ground truth for the AI coach: today's exact machine session with last-session numbers. */
function buildProgressionContext(
  profile: TrainingProfile | undefined,
  workouts: Workout[],
  date: IsoDate
): string {
  const s = buildSession(profile, workouts, date);
  const lines = s.prescriptions.map((p) => {
    const load = find(p.exercise)?.load ?? "Standard";
    const last = pinHistory(p.exercise, load, workouts, false)[0] as PinSession | undefined;
    const lastText = last ? `last ${last.date}: ${lbs(last.weight)} lb × ${last.reps.join("/")}` : "no log yet";
    return `- ${formatLine(p)} (${lastText})`;
  });
  return [
    `Planet Fitness machine week (machines and cables only, no free weights). Today: ${s.title}, ~${s.estMinutes} min.`,
    `Week: ${weekLine()}`,
    ...lines
  ].join("\n");
}

/** "Mon Push A: Chest Focus · Tue Pull A: Lats & Abs · …". */
function weekLine(): string {
  return DAYS.map((d) => `${weekdayShortName(d.weekday)} ${d.name}`).join(" · ");
}

/* ------------------------------------------------------------------- data -- */

function video(id: string, startSec = 0): HowToVideo {
  return { id, startSec };
}

/** Java `URLEncoder.encode(value, "UTF-8")`: spaces → "+", and !'()~ escaped too. */
function formEncode(value: string): string {
  return encodeURIComponent(value)
    .replace(/[!'()~]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`)
    .replace(/%20/g, "+");
}

function m(
  name: string,
  load: MachineLoad,
  setup: string,
  cues: string,
  mistake: string,
  swaps: string[],
  videoQuery: string,
  unilateral = false
): GymMachine {
  const checked = VIDEOS[name] as HowToVideo | undefined;
  return {
    name,
    load,
    setup,
    cues,
    mistake,
    swaps,
    videoQuery,
    unilateral,
    video: checked,
    videoUrl: checked
      ? howToVideoUrl(checked)
      : `https://www.youtube.com/results?search_query=${formEncode(videoQuery)}`,
    instructions: [
      `Setup: ${setup}`,
      `Form: ${cues}`,
      `Avoid: ${mistake}`,
      ...(swaps.length > 0 ? [`Busy? ${swaps.join(" or ")}`] : [])
    ].join("\n")
  };
}

function slot(
  machine: string,
  group: string,
  sets: number,
  low: number,
  high: number,
  rest: number,
  options: { superset?: boolean; switch?: number; easy?: boolean; note?: string } = {}
): MachineSlot {
  return {
    machine,
    group,
    sets,
    low,
    high,
    restSec: rest,
    supersetWithNext: options.superset ?? false,
    switchSec: options.switch ?? 30,
    ...(options.easy !== undefined ? { easy: options.easy } : {}),
    ...(options.note !== undefined ? { note: options.note } : {})
  };
}

/**
 * One how-to video per machine, each checked playable and showing that exact exercise —
 * filmed on Planet Fitness or Hammer Strength machines where a clear one exists.
 */
const VIDEOS: Record<string, HowToVideo> = {
  "Seated Chest Press": video("4SscB4eAxt4"),
  "Hammer Strength Chest Press": video("xACdhd6HPMA"),
  "Hammer Strength Incline Press": video("ycJk61Olw1Q"),
  "Cable Chest Press": video("fOHouR0t9Cw"),
  "Pec Fly": video("CJBQwtEiY5c"),
  "Cable Chest Fly": video("T7unVbaT7bM"),
  "Low-to-High Cable Fly": video("eQ_NBB6OBH4"),
  "Seated Shoulder Press": video("R0iSngQiUFo"),
  "Hammer Strength Shoulder Press": video("Ws-hajwPQDI"),
  "Cable Shoulder Press": video("aX8Hgk2zkQ0"),
  "Cable Lateral Raise": video("Z9KwFXXxkKQ"),
  "Single-Arm Cable Lateral": video("Az_0nsym9AY"),
  "Rear Delt Fly": video("PvakIGAH8Ss", 171),
  "Cable Face Pull": video("3pToT5_DUiY"),
  "Cable Reverse Fly": video("xGOOJnkXmdA"),
  "Machine Triceps Extension": video("uFgpzJW8t2w"),
  "Triceps Press": video("4W31U8tTVAg"),
  "Assisted Dip": video("D8RIzFsK8gA"),
  "Rope Pushdown": video("n2FSCB4vRSA"),
  "Hammer Strength Front Pulldown": video("wvVU6P5LkCQ"),
  "Lat Pulldown": video("grz-WsiBbrw"),
  "Single-Arm Cable Pulldown": video("iOAcUe8P_cc"),
  "Assisted Chin-Up": video("k86abpNuZUc", 247),
  "Seated Row": video("tYk2f1EuwV0"),
  "Hammer Strength Iso-Lateral Row": video("gy-_QDUgGi4"),
  "Seated Cable Row": video("m-UTSvcTpxM"),
  "Biceps Curl": video("Sk5KMr-h6sg"),
  "Cable Curl": video("2MUEL4nL6hA"),
  "Rope Hammer Curl": video("1Quc_tOv97I"),
  "Hammer Strength Ab Crunch": video("2lgjygJVOf0"),
  "Abdominal Crunch": video("Q6ISUZhkBHk"),
  "Cable Crunch": video("kc0PRn372lo"),
  "Rotary Torso": video("8ayNtTI_d8Q"),
  "Cable Woodchop": video("he4IhLc1d5k"),
  "Pallof Press": video("_2xWmYNnFS8"),
  "Seated Back Extension": video("faeSexs32cM"),
  "Cable Pull-Through": video("fbF4_pn_0xc"),
  "Leg Press": video("ZDsiwCn6zA4"),
  "Hack Squat": video("OXnMyNG3IkU"),
  "Leg Extension": video("eA6UCgrgQmE"),
  "Seated Leg Curl": video("Te2CXCfQweY"),
  "Cable Leg Curl": video("Y1dQUd6OKHk"),
  "Glute Kickback": video("fDoIUkh5Myk"),
  "Cable Kickback": video("5jJNfIlKTmg"),
  "Hip Adductor": video("iYcS9jCA6gE"),
  "Hip Abductor": video("ctSsNDgOTmk"),
  "Cable Adduction": video("SIQrpq6YnT8"),
  "Cable Abduction": video("bGlm-qTnfTI"),
  "Calf Extension": video("yQeLdSFBCEM"),
  "Calf Press": video("OMUvfMZOcSA"),
  "Seated Calf": video("6O5hh1rBtx8")
};

/**
 * Every machine the week uses or swaps to. Purple Planet Fitness (Matrix) pin-stack machines,
 * the Hammer Strength iso-lateral row in the photos, the cable towers / functional trainer, and
 * two optional plate-loaded machines (Hack Squat, Seated Calf) as swaps only.
 */
const MACHINES: readonly GymMachine[] = [
  m(
    "Seated Chest Press",
    "Standard",
    "Planet Fitness Chest Press (placard may say Converging Chest Press). Seat so the handles line up with mid-chest; back and shoulder blades flat on the pad, feet planted.",
    "Brace, press until your arms are straight but not locked, breathe out. Lower slowly to a light chest stretch.",
    "Shoulders rolling forward off the pad, or arching your lower back because the pin is too heavy.",
    ["Hammer Strength Chest Press", "Cable Chest Press"],
    "seated chest press machine proper form"
  ),
  m(
    "Hammer Strength Chest Press",
    "Standard",
    "Hammer Strength MTS iso-lateral chest press (check the placards in that row; one stack per arm, set both pins the same): seat so the handles start at mid-chest, back flat on the pad.",
    "Press both arms together (or one at a time), stop short of lockout, return over 2–3 s.",
    "Letting one arm drift ahead of the other, or bouncing out of the stretch.",
    ["Seated Chest Press", "Cable Chest Press"],
    "hammer strength iso lateral chest press machine form"
  ),
  m(
    "Hammer Strength Incline Press",
    "Standard",
    "Hammer Strength MTS incline press, if your row has one (one stack per arm, set both pins the same). Seat so the handles start at or just below collarbone height; back flat, feet planted.",
    "Press up and slightly in, stop just short of lockout, lower with your chest up and shoulder blades pinned.",
    "Shrugging toward your ears, or a seat so low your shoulders pinch: shorten the range if it pinches.",
    ["Seated Chest Press", "Cable Chest Press"],
    "hammer strength incline press machine form"
  ),
  m(
    "Cable Chest Press",
    "Standard",
    "Functional trainer: both pulleys at chest height, handles in, one foot forward.",
    "Press both handles forward and slightly together, then let them come back slowly to a chest stretch.",
    "Leaning into it so your body weight does the pushing.",
    ["Seated Chest Press"],
    "standing cable chest press form"
  ),
  m(
    "Pec Fly",
    "Small",
    "Rear Delt / Pec Fly machine in fly mode: back on the pad, handles at chest height, start lever set for a light stretch.",
    "Keep a slight, fixed elbow bend and hug the handles together in an arc; return slowly.",
    "Bending the elbows more as it gets hard, which turns the fly into a press.",
    ["Cable Chest Fly", "Low-to-High Cable Fly"],
    "pec deck fly machine proper form"
  ),
  m(
    "Cable Chest Fly",
    "Small",
    "Functional trainer: both pulleys at chest height, step forward into a split stance.",
    "Soft elbows, sweep the handles together in front of your chest, squeeze, open slowly.",
    "Turning it into a press by bending the elbows.",
    ["Pec Fly"],
    "cable chest fly proper form"
  ),
  m(
    "Low-to-High Cable Fly",
    "Small",
    "Functional trainer: both pulleys at the bottom, handles in, step forward.",
    "Sweep your hands up and together to chin height to work the upper chest; lower slowly.",
    "Shrugging the handles up with your traps.",
    ["Pec Fly", "Cable Chest Fly"],
    "low to high cable fly upper chest form"
  ),
  m(
    "Seated Shoulder Press",
    "Standard",
    "Planet Fitness Shoulder Press (in your photos). Seat so the handles sit at or just above shoulder height; back and head on the pad.",
    "Ribs down, press straight up until your arms are nearly straight; lower to shoulder level without bouncing.",
    "Arching and leaning back, which turns it into an incline press. Drop the pin if your back leaves the pad.",
    ["Hammer Strength Shoulder Press", "Cable Shoulder Press"],
    "shoulder press machine proper form seat height"
  ),
  m(
    "Hammer Strength Shoulder Press",
    "Standard",
    "Hammer Strength MTS iso-lateral shoulder press, if your row has one (set both pins the same): seat so the handles start at shoulder height.",
    "Press up together or alternating, stop short of lockout, lower slowly to shoulder level.",
    "Leaning back off the pad to finish the rep.",
    ["Seated Shoulder Press", "Cable Shoulder Press"],
    "hammer strength iso lateral shoulder press form"
  ),
  m(
    "Cable Shoulder Press",
    "Standard",
    "Functional trainer: pulleys at the bottom, stand between them with handles at your shoulders.",
    "Brace and press overhead, then lower slowly back to shoulder height.",
    "Over-arching your lower back.",
    ["Seated Shoulder Press"],
    "standing cable shoulder press form"
  ),
  m(
    "Cable Lateral Raise",
    "Small",
    "Functional trainer: both pulleys at the bottom; hold the opposite handles so the cables cross in front of you.",
    "Lead with your elbows and raise out to shoulder height, pause, lower slowly.",
    "Shrugging or swinging, which moves the work to your traps.",
    ["Single-Arm Cable Lateral"],
    "cable lateral raise both arms crossover form"
  ),
  m(
    "Single-Arm Cable Lateral",
    "Small",
    "One pulley at the bottom, stand side-on and take the handle with your far hand.",
    "Raise out to shoulder height leading with the elbow, lower slowly; do all reps, then switch arms.",
    "Leaning away and using momentum.",
    ["Cable Lateral Raise"],
    "single arm cable lateral raise form",
    true
  ),
  m(
    "Rear Delt Fly",
    "Small",
    "Rear Delt / Pec Fly machine in rear-delt mode: chest on the pad, handles swung back, at shoulder height.",
    "Palms in, sweep your arms back until they line up with your body, return slowly.",
    "Shrugging, which lets your traps take over.",
    ["Cable Face Pull", "Cable Reverse Fly"],
    "reverse pec deck rear delt fly machine form"
  ),
  m(
    "Cable Face Pull",
    "Small",
    "Pulley at eye-to-forehead height with a rope; thumbs toward you, step back until your arms are straight.",
    "Pull toward your face with elbows high and pull the rope apart so your hands finish beside your ears.",
    "Elbows dropping below your shoulders (that's a row), or leaning back.",
    ["Rear Delt Fly", "Cable Reverse Fly"],
    "cable face pull proper form rope height"
  ),
  m(
    "Cable Reverse Fly",
    "Small",
    "Functional trainer: pulleys at shoulder height, cross the cables (left hand takes the right cable).",
    "Soft elbows, open your arms out and back to a T, squeeze, return slowly.",
    "Bending the elbows and rowing.",
    ["Rear Delt Fly", "Cable Face Pull"],
    "cable reverse fly rear delt form"
  ),
  m(
    "Machine Triceps Extension",
    "Small",
    "Seat so your elbows rest on the pad in line with the pivot; back against the pad.",
    "Keep your upper arms still and push until your arms are nearly straight; return slowly to about 90°.",
    "Elbows lifting off the pad or flaring, or slamming into lockout.",
    ["Rope Pushdown", "Triceps Press"],
    "triceps extension machine how to use"
  ),
  m(
    "Triceps Press",
    "Standard",
    "Planet Fitness Triceps Press (placard may say Seated Dip). Seat so you start with your elbows bent about 90° on the handles; sit tall against the pad.",
    "Shoulders down, chest up, elbows tucked; push down until your arms are nearly straight, let them rise slowly.",
    "Shrugging or leaning far forward.",
    ["Assisted Dip", "Machine Triceps Extension"],
    "seated dip machine triceps press proper form"
  ),
  m(
    "Assisted Dip",
    "Assisted",
    "Dip / Chin Assist machine: more weight = more help. Grip the dip handles with straight arms, kneel on the pad.",
    "Shoulders down, elbows tucked, lower until your upper arms are about parallel, press back up. Stay upright for triceps.",
    "Dropping too deep or shrugging at the bottom, which strains the front of the shoulder.",
    ["Triceps Press"],
    "assisted dip machine how to use proper form"
  ),
  m(
    "Rope Pushdown",
    "Small",
    "High pulley with a rope; stand close, slight forward lean, elbows at your sides.",
    "Elbows pinned, push down until straight and spread the rope at the bottom; let your forearms rise to about 90°.",
    "Elbows drifting forward, or leaning over to shove with your body.",
    ["Machine Triceps Extension"],
    "cable tricep pushdown proper form rope"
  ),
  m(
    "Hammer Strength Front Pulldown",
    "Standard",
    "Hammer Strength MTS front pulldown (in your photos; one stack per arm, set both pins the same): thigh pad snug, reach up to the handles with straight arms.",
    "Pull your shoulders down first, then drive your elbows to your ribs; let the handles rise slowly to a full stretch.",
    "Yanking with your body or cutting the stretch short at the top.",
    ["Lat Pulldown", "Single-Arm Cable Pulldown"],
    "hammer strength iso lateral front pulldown form"
  ),
  m(
    "Lat Pulldown",
    "Standard",
    "Planet Fitness Lat Pulldown (may say Diverging Lat Pulldown). Thigh pad snug; grip the bar a little wider than shoulders (or close / neutral if your day says so).",
    "Lean back slightly, pull your shoulders down, then drive your elbows down to bring the bar to your upper chest. Rise slowly.",
    "Leaning far back and yanking, or pulling behind your neck.",
    ["Hammer Strength Front Pulldown", "Single-Arm Cable Pulldown"],
    "lat pulldown proper form"
  ),
  m(
    "Single-Arm Cable Pulldown",
    "Small",
    "High pulley with a single handle; kneel facing the stack.",
    "Drive your elbow down to your ribs, pause, let it rise to a full stretch; all reps, then switch sides.",
    "Twisting your torso to finish the rep.",
    ["Lat Pulldown"],
    "kneeling single arm cable pulldown form",
    true
  ),
  m(
    "Assisted Chin-Up",
    "Assisted",
    "Dip / Chin Assist machine: more weight = more help. Use the neutral handles; lower your knees onto the pad one at a time.",
    "From a full hang with shoulders down, drive your elbows to your ribs until your chin clears the bar; lower slowly.",
    "Letting the pad bounce you out of the bottom, or half reps. Use enough help to control the whole range.",
    ["Lat Pulldown", "Hammer Strength Front Pulldown"],
    "assisted pull up machine how to use properly"
  ),
  m(
    "Seated Row",
    "Standard",
    "Seat so the handles are between lower chest and shoulder height; chest pad so you just reach with straight arms.",
    "Pull your elbows back close to your sides and squeeze your shoulder blades; extend slowly without rounding.",
    "Rocking your chest off the pad or leaning back to move the weight.",
    ["Hammer Strength Iso-Lateral Row", "Seated Cable Row"],
    "seated row machine proper form"
  ),
  m(
    "Hammer Strength Iso-Lateral Row",
    "Standard",
    "Hammer Strength MTS row (in your photos; one stack per arm, set both pins the same; 5 lb add-on weights for small jumps): chest on the pad, seat so the handles line up with your lower chest.",
    "Pull both handles to your lower ribs and pause 1 s; let your shoulder blades stretch forward on the way back.",
    "Lifting your chest off the pad to heave the weight.",
    ["Seated Row", "Seated Cable Row"],
    "hammer strength iso lateral row form"
  ),
  m(
    "Seated Cable Row",
    "Standard",
    "Low pulley with a seat and a neutral V-handle; feet on the plate, knees soft.",
    "Sit tall with no rocking and pull to your belly with elbows close; return slowly to a stretch.",
    "Swinging your torso back and forth.",
    ["Seated Row", "Hammer Strength Iso-Lateral Row"],
    "seated cable row v handle proper form"
  ),
  m(
    "Biceps Curl",
    "Small",
    "Seat so the backs of your arms lie flat on the pad, armpits snug, elbows at the pivot.",
    "Curl by bending only at the elbows and squeeze; lower slowly until almost straight.",
    "Elbows lifting off the pad or shoulders rolling forward.",
    ["Cable Curl", "Rope Hammer Curl"],
    "biceps curl machine proper form seat adjustment"
  ),
  m(
    "Cable Curl",
    "Small",
    "Low pulley with a bar; stand tall close to the stack, underhand grip.",
    "Elbows pinned, curl toward your upper chest without moving your upper arms; lower slowly.",
    "Leaning back and swinging.",
    ["Biceps Curl", "Rope Hammer Curl"],
    "cable bicep curl proper form low pulley"
  ),
  m(
    "Rope Hammer Curl",
    "Small",
    "Low pulley with a rope; palms facing each other.",
    "Elbows at your sides, curl the rope up keeping wrists straight; lower slowly.",
    "Elbows drifting forward to finish the rep.",
    ["Biceps Curl", "Cable Curl"],
    "cable rope hammer curl form"
  ),
  m(
    "Hammer Strength Ab Crunch",
    "Standard",
    "Hammer Strength abdominal crunch (in your photos): seat so the handles sit at your upper chest, feet under the rollers.",
    "Breathe out and curl your ribs toward your hips, squeeze a second, return slowly without resting the stack.",
    "Pulling with your arms or swinging from the hips.",
    ["Abdominal Crunch", "Cable Crunch"],
    "hammer strength ab crunch machine form"
  ),
  m(
    "Abdominal Crunch",
    "Standard",
    "Planet Fitness ab machine: seat so the pads sit at your upper chest; hook your feet under the rollers.",
    "Curl your ribs toward your hips and squeeze; return slowly.",
    "Pulling with your arms or using a pin so heavy you swing.",
    ["Hammer Strength Ab Crunch", "Cable Crunch"],
    "ab crunch machine proper form"
  ),
  m(
    "Cable Crunch",
    "Standard",
    "Rope on a high pulley; kneel facing the stack about an arm's length away, rope ends beside your head.",
    "Keep your hips high and still and curl your ribs toward your hips; uncurl slowly against the cable.",
    "Sitting back on your heels and pulling with your arms.",
    ["Hammer Strength Ab Crunch", "Abdominal Crunch"],
    "kneeling cable crunch proper form"
  ),
  m(
    "Rotary Torso",
    "Standard",
    "Set the range pin to a comfortable twist (not your max); lock your legs in and put your chest against the pad.",
    "Keep your hips still and rotate slowly from your midsection, pause, return; then switch sides.",
    "Momentum, or a range so big it wrenches your lower back.",
    ["Pallof Press", "Cable Woodchop"],
    "rotary torso machine how to use proper form",
    true
  ),
  m(
    "Cable Woodchop",
    "Small",
    "Single handle on a high pulley; stand side-on, feet shoulder-width, both hands on the handle.",
    "Brace and rotate through your torso and hips, pulling down across your body to the opposite knee; return slowly, both sides.",
    "Pulling with your arms or twisting only from your lower back.",
    ["Rotary Torso", "Pallof Press"],
    "cable woodchop high to low proper form",
    true
  ),
  m(
    "Pallof Press",
    "Small",
    "Handle on a pulley at chest height; stand side-on, handle at your chest.",
    "Press the handle straight out and hold 2 s without letting it twist you; return. Both sides. Easier on the lower back than twisting.",
    "Letting your hips or shoulders rotate toward the stack.",
    ["Rotary Torso", "Cable Woodchop"],
    "cable pallof press form",
    true
  ),
  m(
    "Seated Back Extension",
    "Standard",
    "Seated back extension: hips at the back of the seat, feet on the plate, pad across your shoulder blades.",
    "Brace and hinge back until your body is straight, squeezing your glutes; return slowly.",
    "Pushing past straight into a lower-back arch, or jerking the weight.",
    ["Cable Pull-Through"],
    "seated back extension machine proper form"
  ),
  m(
    "Cable Pull-Through",
    "Small",
    "Rope on the low pulley; face away, rope between your legs, walk out two steps.",
    "Soft knees, push your hips back until you feel your hamstrings, then drive your hips forward and squeeze your glutes.",
    "Squatting it instead of hinging, or pulling with your arms.",
    ["Seated Back Extension", "Seated Leg Curl"],
    "cable pull through proper form"
  ),
  m(
    "Leg Press",
    "LegPress",
    "Seat so your knees are bent about 90°; feet flat mid-platform, hip-to-shoulder width; back and tailbone on the pad.",
    "Push through your whole foot, knees over toes, until your legs are nearly straight; lower until just before your hips lift.",
    "Locking your knees at the top, or going so deep your butt lifts and your lower back rounds.",
    ["Hack Squat", "Leg Extension"],
    "seated leg press machine proper form"
  ),
  m(
    "Hack Squat",
    "LegPress",
    "Plate-loaded (optional): back flat on the pad, shoulders under the pads, feet shoulder-width mid-platform. Release the safeties.",
    "Lower until your thighs are about parallel with heels down; drive up through mid-foot without locking out. Re-engage the safeties.",
    "Heels lifting, knees caving, or your lower back peeling off the pad.",
    ["Leg Press"],
    "hack squat machine proper form foot placement"
  ),
  m(
    "Leg Extension",
    "Standard",
    "Back pad so your knee lines up with the pivot dot; shin pad just above your ankles; hold the side handles.",
    "Straighten fully and squeeze your quads for a second; lower over 2–3 s with your hips on the seat.",
    "Shin pad too high up the leg, or swinging your hips to throw the weight.",
    ["Leg Press", "Hack Squat"],
    "leg extension machine proper form knee alignment"
  ),
  m(
    "Seated Leg Curl",
    "Standard",
    "Knees at the pivot; ankle pad just above your heels; thigh pad lowered snug above your knees.",
    "Curl your heels down and back as far as you can and squeeze; return slowly without slamming the stack.",
    "A loose thigh pad, so your hips lift and you jerk the weight.",
    ["Cable Leg Curl", "Cable Pull-Through"],
    "seated leg curl machine proper setup form"
  ),
  m(
    "Cable Leg Curl",
    "Small",
    "Ankle strap on a low pulley; face the stack holding the frame.",
    "Curl your heel toward your glute keeping your knee pointed down; lower slowly. All reps, then switch legs.",
    "Swinging the leg or arching your back.",
    ["Seated Leg Curl"],
    "standing cable leg curl ankle strap form",
    true
  ),
  m(
    "Glute Kickback",
    "Standard",
    "Planet Fitness glute machine: forearms and chest on the pads, working foot on the plate, standing leg planted.",
    "Brace and drive the working leg back and up by squeezing your glute until your hip is straight; pause, return. All reps, then switch.",
    "Arching your lower back for more range instead of finishing with the glute.",
    ["Cable Kickback", "Hip Abductor"],
    "glute kickback machine proper form standing",
    true
  ),
  m(
    "Cable Kickback",
    "Small",
    "Ankle strap on a low pulley; face the stack, hands on the frame, slight forward lean.",
    "Kick the strapped leg back and slightly out, squeeze the glute at the top, return slowly. All reps, then switch.",
    "Swinging, or arching your lower back.",
    ["Glute Kickback"],
    "cable glute kickback ankle strap form",
    true
  ),
  m(
    "Hip Adductor",
    "Standard",
    "Start lever set for a comfortable stretch (not your widest split); back on the pad, pads inside your knees.",
    "Squeeze your knees together and pause 1 s; open back slowly to the stretch.",
    "Starting too wide and then slamming the weight.",
    ["Cable Adduction", "Leg Press"],
    "hip adduction machine proper form"
  ),
  m(
    "Hip Abductor",
    "Standard",
    "Start lever so your legs begin together or slightly apart; pads on the outside of your knees.",
    "Push your knees out to a comfortable end range, pause 1 s, return without the stack touching.",
    "Bouncing with momentum or half reps.",
    ["Cable Abduction", "Cable Kickback"],
    "hip abduction machine proper form glutes"
  ),
  m(
    "Cable Adduction",
    "Small",
    "Ankle strap on a low pulley; stand side-on with the strapped leg nearest the stack.",
    "Sweep the leg across in front of your standing leg, pause, return slowly. All reps, then switch.",
    "Leaning your torso to swing the leg.",
    ["Hip Adductor"],
    "standing cable hip adduction form",
    true
  ),
  m(
    "Cable Abduction",
    "Small",
    "Ankle strap on a low pulley; stand side-on with the strapped leg farthest from the stack.",
    "Lift the leg out to the side with toes forward, pause, lower slowly. All reps, then switch.",
    "Leaning away from the stack to cheat the range.",
    ["Hip Abductor"],
    "standing cable hip abduction form",
    true
  ),
  m(
    "Calf Extension",
    "Standard",
    "Separate Calf Extension machine, if your club has one: balls of your feet on the bottom edge, heels free, knees soft.",
    "Point your toes as far as you can and pause; lower slowly to a full stretch without bouncing.",
    "Short bouncy reps, or bending your knees so your quads push.",
    ["Calf Press", "Seated Calf"],
    "calf press on leg press machine proper form"
  ),
  m(
    "Calf Press",
    "LegPress",
    "On the seated Leg Press: balls of your feet on the bottom edge of the platform, heels hanging off, knees soft.",
    "Press through the balls of your feet to point your toes, pause, lower to a full stretch.",
    "Bending your knees so your quads do the work.",
    ["Calf Extension", "Seated Calf"],
    "calf press on leg press machine proper form"
  ),
  m(
    "Seated Calf",
    "Standard",
    "Plate-loaded seated calf (optional): pad snug on your lower thighs, balls of your feet on the platform.",
    "Rise as high as you can, pause, lower for a deep stretch.",
    "Bouncing out of the bottom.",
    ["Calf Extension", "Calf Press"],
    "seated calf raise machine proper form"
  )
];

/** The week: Push A · Pull A · Legs A · Push B · Pull B · Legs B · light full body. */
const DAYS: readonly MachineDay[] = [
  {
    weekday: "MONDAY",
    name: "Push A: Chest Focus",
    focus: "Heavier chest pressing at 8–12 reps and a short shoulder press, then a pec fly / triceps pair on neighboring machines, cable laterals and back extensions.",
    warmup: "2 ramp sets on the Seated Chest Press: about 10 reps at half your work weight, then about 5 at roughly 70% (about 3 min).",
    slots: [
      slot("Seated Chest Press", "Chest", 3, 8, 12, 120, { note: "Shoulder blades stay on the pad; lower over 2–3 s." }),
      slot("Hammer Strength Incline Press", "Chest", 2, 8, 12, 90, { note: "No incline model in the Hammer row? Use the Cable Chest Press with the pulleys low." }),
      slot("Seated Shoulder Press", "Shoulders", 2, 8, 12, 90, { note: "Back and head on the pad, ribs down." }),
      slot("Pec Fly", "Chest", 3, 10, 15, 60, { superset: true, note: "Superset with the Machine Triceps Extension a few steps away. Fixed soft elbows." }),
      slot("Machine Triceps Extension", "Triceps", 3, 10, 15, 60, { note: "Elbows on the pad, in line with the pivot. Machines far apart? Do straight sets." }),
      slot("Cable Lateral Raise", "Shoulders", 3, 10, 15, 60, { note: "Cables crossed in front of you; lead with your elbows." }),
      slot("Seated Back Extension", "Lower back", 2, 10, 15, 60, { note: "Moderate pin; stop at a straight line, never arch past it." })
    ],
    light: false
  },
  {
    weekday: "TUESDAY",
    name: "Pull A: Lats & Abs",
    focus: "Vertical pulling for the lats, a mid-back row and assisted chin-ups, a rear-delt / biceps pair on neighboring machines, then ab crunches.",
    warmup: "2 ramp sets on the Hammer Strength Front Pulldown: about 10 light reps, then about 5 at roughly 70%.",
    slots: [
      slot("Hammer Strength Front Pulldown", "Back", 3, 8, 12, 120, { note: "Shoulders down first, then elbows to your ribs; full stretch at the top." }),
      slot("Seated Row", "Back", 3, 8, 12, 90, { note: "Chest stays on the pad; squeeze the shoulder blades. No rocking." }),
      slot("Assisted Chin-Up", "Back", 3, 8, 12, 90, { note: "Neutral handles; enough help to control every rep from a full hang." }),
      slot("Rear Delt Fly", "Rear delts", 3, 10, 15, 60, { superset: true, note: "Superset with the Biceps Curl a few steps away." }),
      slot("Biceps Curl", "Biceps", 3, 10, 15, 60, { note: "Armpits snug to the pad; lower slowly." }),
      slot("Hammer Strength Ab Crunch", "Abs", 3, 12, 20, 60, { note: "Curl your ribs to your hips; don't pull with your arms." })
    ],
    light: false
  },
  {
    weekday: "WEDNESDAY",
    name: "Legs A: Quads & Hips",
    focus: "Quad-led legs on the leg press and leg extension, balanced with leg curls, glute kickbacks and the inner / outer thigh pair.",
    warmup: "2 ramp sets on the Leg Press: about 10 light reps, then about 5 at roughly 70%.",
    slots: [
      slot("Leg Press", "Quads", 3, 8, 12, 120, { note: "Feet mid-platform, hip-width; lower until just before your hips lift. Don't lock your knees." }),
      slot("Leg Extension", "Quads", 4, 10, 15, 60, { superset: true, note: "Superset with the Seated Leg Curl next to it. 1 s squeeze at the top." }),
      slot("Seated Leg Curl", "Hamstrings", 4, 10, 15, 60, { note: "Thigh pad snug so your hips stay down." }),
      slot("Glute Kickback", "Glutes", 3, 10, 15, 60, { note: "Reps per leg: left then right = 1 set." }),
      slot("Hip Adductor", "Adductors", 3, 10, 15, 60, { superset: true, note: "Superset with the Hip Abductor (one combined machine? Flip the pads)." }),
      slot("Hip Abductor", "Abductors", 3, 10, 15, 60, { note: "Lean forward 10–15° to work the glutes more." })
    ],
    light: false
  },
  {
    weekday: "THURSDAY",
    name: "Push B: Shoulders & Chest",
    focus: "Shoulder-first push day, a Hammer Strength chest press and the triceps press, then one cable-station block: flys, single-arm laterals and cable crunches.",
    warmup: "2 ramp sets on the Seated Shoulder Press: about 10 light reps, then about 5 at roughly 70%.",
    slots: [
      slot("Seated Shoulder Press", "Shoulders", 3, 8, 12, 120, { note: "Ribs down, no back arch." }),
      slot("Hammer Strength Chest Press", "Chest", 3, 8, 12, 90, { note: "Row has a decline press instead? Use it. Return slowly to a light stretch." }),
      slot("Triceps Press", "Triceps", 3, 8, 12, 90, { note: "Elbows tucked; easier on the shoulders than bodyweight dips." }),
      slot("Low-to-High Cable Fly", "Chest", 2, 10, 15, 60, { note: "Busy at 5–7 pm? Use the Pec Fly instead of holding the cable station." }),
      slot("Single-Arm Cable Lateral", "Shoulders", 3, 10, 15, 60, { superset: true, switch: 15, note: "Superset on the same cable station: handle low on one column, rope high on the other. Reps per arm." }),
      slot("Cable Crunch", "Abs", 3, 12, 20, 60, { note: "Hips still; curl your ribs toward your hips." })
    ],
    light: false
  },
  {
    weekday: "FRIDAY",
    name: "Pull B: Mid-Back & Arms",
    focus: "Row-led pull day for mid-back thickness, a pulldown, face pulls with hammer curls on one cable station, anti-rotation core and calves.",
    warmup: "2 ramp sets on the Hammer Strength Iso-Lateral Row: about 10 light reps, then about 5 at roughly 70%.",
    slots: [
      slot("Hammer Strength Iso-Lateral Row", "Back", 3, 8, 12, 120, { note: "Handles to your lower ribs, pause 1 s." }),
      slot("Seated Cable Row", "Back", 2, 8, 12, 90, { note: "Neutral V-handle, sit tall, no rocking." }),
      slot("Lat Pulldown", "Back", 2, 8, 12, 90, { note: "Neutral or close handles if there are any." }),
      slot("Cable Face Pull", "Rear delts", 3, 10, 15, 60, { superset: true, note: "Superset on one cable station: rope high for face pulls, low for curls (move it if there's only one rope)." }),
      slot("Rope Hammer Curl", "Biceps", 3, 10, 15, 60, { note: "Elbows pinned to your sides." }),
      slot("Pallof Press", "Obliques", 2, 12, 20, 60, { note: "Reps per side. Press out, hold 2 s, don't let it twist you." }),
      slot("Calf Press", "Calves", 2, 12, 20, 60, { note: "On the leg press: balls of your feet on the bottom edge, knees soft. Separate Calf Extension machine? Use it." })
    ],
    light: false
  },
  {
    weekday: "SATURDAY",
    name: "Legs B: Hamstrings & Glutes",
    focus: "Posterior chain: a glute-biased leg press first, leg curls, a pull-through / kickback pair on one cable station, leg extensions and back extensions.",
    warmup: "2 ramp sets on the Leg Press with your feet high: about 10 light reps, then about 5 at roughly 70%.",
    slots: [
      slot("Leg Press", "Glutes", 3, 8, 12, 120, { note: "Feet high, hip-width or slightly wider, toes out a little; push through your heels." }),
      slot("Seated Leg Curl", "Hamstrings", 3, 10, 15, 60, { note: "Squeeze 1 s at full bend; the last set can go close to failure." }),
      slot("Cable Pull-Through", "Hamstrings", 4, 8, 12, 75, { superset: true, switch: 15, note: "Superset on one cable station: rope low on one column, ankle strap low on the other. Stack too light? Pause 2–3 s in the stretch." }),
      slot("Cable Kickback", "Glutes", 4, 10, 15, 75, { note: "Reps per leg; finish with the glute, not your lower back." }),
      slot("Leg Extension", "Quads", 3, 10, 15, 60, { note: "Controlled reps for your second quad day." }),
      slot("Seated Back Extension", "Lower back", 2, 10, 15, 60, { note: "Moderate pin after the pull-throughs; stop at a straight line." })
    ],
    light: false
  },
  {
    weekday: "SUNDAY",
    name: "Full-Body Light: Hips & Core",
    focus: "Light full body in straight sets: leg press, chest press, row and hip machines at an easy effort, plus normal-effort calves and woodchops.",
    warmup: "2 light ramp sets on the Leg Press: about 10 reps at 40%, then about 6 at 60% of today's already-light weight.",
    slots: [
      slot("Leg Press", "Quads", 3, 10, 12, 120, { note: "Sore from Saturday? Do 2 sets." }),
      slot("Calf Press", "Calves", 3, 12, 20, 60, { easy: false, note: "Stay on the leg press. Calves recover fast, so normal effort is fine." }),
      slot("Seated Chest Press", "Chest", 2, 10, 12, 90, { note: "Smooth reps; recovery work before Monday." }),
      slot("Seated Row", "Back", 2, 10, 12, 90, { note: "1 s squeeze on each rep." }),
      slot("Hip Adductor", "Adductors", 2, 10, 15, 60),
      slot("Hip Abductor", "Abductors", 2, 10, 15, 60, { note: "Sit upright today (a different angle from Wednesday)." }),
      slot("Cable Woodchop", "Obliques", 2, 12, 20, 60, { easy: false, note: "Reps per side; start with a small range. Stop with 2–3 reps left." })
    ],
    light: true
  }
];

/* ---------------------------------------------------------------- exports -- */

/** The machine week, shaped like the Kotlin `object MachineWeek` so the two ports read the same. */
export const MachineWeek = {
  WORK_SECONDS,
  LONG_WORK_SECONDS,
  SETUP_SECONDS,
  WARMUP_SECONDS,
  /** Every machine the week uses or swaps to. */
  MACHINES,
  /** The week: Push A · Pull A · Legs A · Push B · Pull B · Legs B · light full body. */
  DAYS,
  estimateMinutes,
  weeklySets,
  find,
  day,
  dayFor,
  planId,
  weekdayOf,
  isMachineWeek,
  loggerHistory,
  isAssisted,
  prescribe,
  isLightSession,
  scheme,
  buildSession,
  formatLine,
  buildProgressionContext
} as const;

/**
 * AI prompt guidance when the coach style is machine_week. The app keeps the
 * programmed machine day as the strength item (the AI's strength item is
 * replaced client-side, like Android's TrainPlanService), so the model only has
 * to echo it and tailor the optional buckets.
 */
export const machineWeekStyleGuide = [
  "COACH STYLE GUIDE — PLANET FITNESS MACHINE WEEK (follow this exactly):",
  "The user trains at Planet Fitness on pin-stack machines, cable stations and the assisted dip/chin ONLY — no dumbbells, barbells, kettlebells or Smith machine.",
  `Seven fixed ~45-minute sessions, one per weekday: ${weekLine()}.`,
  "Today's machine session in the PROGRESSION SNAPSHOT is the user's real gym program and the app keeps it as the strength item. Copy it as the strength item (kind 'custom', variant 'Machine'): same title, machines, order, sets, reps, pins (weightLbs) and rest, with 'group' and 'scheme' on every prescription. Never replace it with free weights, a different split or a preset.",
  "Put your effort into the cardio and martial-arts items so they fit around today's machine day."
].join("\n");
