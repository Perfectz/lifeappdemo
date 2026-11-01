import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { POST } from "@/app/api/ai/workout-suggestion/route";
import {
  buildWorkoutContext,
  getOrComputeWorkoutPlan,
  swapBucketPreset
} from "@/client/workoutSuggestion";
import { saveTrainingProfile } from "@/data/trainingProfileRepository";
import { toLocalIsoDate } from "@/domain/dates";
import {
  MACHINE_LOAD_STEP_LBS,
  MachineWeek,
  howToVideoUrl,
  machineWeekStyleGuide,
  weekdays,
  type MachineLoad,
  type MachineSlot
} from "@/domain/machineWeek";
import { detectNewRecords } from "@/domain/personalRecords";
import { normalizeExerciseName } from "@/domain/strengthProgression";
import { defaultTrainingProfile, type TrainingProfile } from "@/domain/trainingProfile";
import type { StrengthSet, Workout } from "@/domain/types";
import {
  buildProgressivePlan,
  buildWorkoutCatalog,
  isDailyWorkoutPlan,
  machineWeekSuggestion,
  parseDailyWorkoutPlan,
  type DailyWorkoutPlan
} from "@/domain/workoutPlan";
import { resetCoachModelFallbackForTests } from "@/server/ai/modelFallback";
import { resetRateLimiter } from "@/server/ai/rateLimiter";
import {
  setWorkoutCoachForTests,
  suggestDailyWorkoutPlan,
  type WorkoutSuggestionInput
} from "@/server/ai/workoutCoachClient";

const NOW = "2026-11-01T12:00:00.000Z";
const SUNDAY_TITLE = "Sunday · Full-Body Light: Hips & Core";

const profile: TrainingProfile = {
  ...defaultTrainingProfile(NOW),
  equipment: {
    kettlebells: false,
    dumbbells: false,
    bands: false,
    barbell: false,
    machines: true,
    pullupBar: false
  },
  coachStyle: "machine_week"
};

/** One logged strength session: every set is [machine, weight, reps]. */
function strength(date: string, ...sets: [string, number, number][]): Workout {
  return {
    id: `w-${date}`,
    date,
    type: "strength",
    source: "manual",
    title: "machine day",
    sets: sets.map(([exercise, weightLbs, reps]): StrengthSet => ({ exercise, weightLbs, reps })),
    recordedAt: `${date}T12:00:00Z`,
    createdAt: `${date}T12:00:00Z`,
    updatedAt: `${date}T12:00:00Z`
  };
}

/** One logged session of a single machine: every set is [weight, reps]. */
function sets(date: string, title: string, machine: string, ...ws: [number, number][]): Workout {
  return { ...strength(date, ...ws.map(([w, r]): [string, number, number] => [machine, w, r])), id: `w-${date}-${machine}`, title };
}

function slotFor(load: MachineLoad): MachineSlot {
  const machine = MachineWeek.MACHINES.find((m) => m.load === load)!;
  return {
    machine: machine.name,
    group: "Chest",
    sets: 3,
    low: 8,
    high: 12,
    restSec: 90,
    supersetWithNext: false,
    switchSec: 30
  };
}

const majors = ["Chest", "Back", "Shoulders", "Quads", "Hamstrings", "Glutes"];
const allGroups = [
  "Chest",
  "Back",
  "Shoulders",
  "Rear delts",
  "Biceps",
  "Triceps",
  "Quads",
  "Hamstrings",
  "Glutes",
  "Adductors",
  "Abductors",
  "Calves",
  "Abs",
  "Obliques",
  "Lower back"
];

/* --------------------------------------------------------------- the week -- */

describe("machine week: the week", () => {
  it("has seven different days, Monday to Sunday", () => {
    expect(MachineWeek.DAYS.map((d) => d.weekday)).toEqual([...weekdays]);
    expect(new Set(MachineWeek.DAYS.map((d) => d.name)).size).toBe(7);
    expect(new Set(MachineWeek.DAYS.map((d) => d.slots.map((s) => s.machine).join("|"))).size).toBe(7);
  });

  it("keeps every day at about 45 minutes", () => {
    for (const d of MachineWeek.DAYS) {
      const minutes = MachineWeek.estimateMinutes(d);
      expect(minutes, d.weekday).toBeGreaterThanOrEqual(43);
      expect(minutes, d.weekday).toBeLessThanOrEqual(47);
      expect(d.slots.length).toBeGreaterThanOrEqual(5);
      expect(d.slots.length).toBeLessThanOrEqual(8);
    }
  });

  it("matches the minutes of the reviewed plan (same timing model as Android)", () => {
    const expected: Record<string, number> = {
      MONDAY: 45,
      TUESDAY: 46,
      WEDNESDAY: 46,
      THURSDAY: 46,
      FRIDAY: 46,
      SATURDAY: 46,
      SUNDAY: 46
    };
    for (const d of MachineWeek.DAYS) {
      expect(MachineWeek.estimateMinutes(d), d.weekday).toBe(expected[d.weekday]);
    }
  });

  it("uses machines and cables only", () => {
    const free = /dumbbell|barbell|kettlebell|smith|free weight|\bdb\b|\bkb\b/i;
    for (const m of MachineWeek.MACHINES) {
      expect(free.test(m.name), m.name).toBe(false);
      for (const swap of m.swaps) expect(free.test(swap), `${m.name} swap ${swap}`).toBe(false);
    }
    for (const s of MachineWeek.DAYS.flatMap((d) => d.slots)) {
      expect(free.test(`${s.machine} ${s.note ?? ""}`), s.machine).toBe(false);
    }
  });

  it("only programs and swaps to catalog machines", () => {
    for (const s of MachineWeek.DAYS.flatMap((d) => d.slots)) {
      expect(MachineWeek.find(s.machine), `missing ${s.machine}`).toBeDefined();
    }
    for (const m of MachineWeek.MACHINES) {
      for (const swap of m.swaps) {
        expect(MachineWeek.find(swap), `${m.name} swap '${swap}' isn't a catalog machine`).toBeDefined();
        expect(MachineWeek.find(swap)?.name, `${m.name} swaps to itself`).not.toBe(m.name);
      }
    }
  });

  it("never has one machine name inside another", () => {
    const keys = MachineWeek.MACHINES.map((m) => normalizeExerciseName(m.name));
    expect(new Set(keys).size).toBe(keys.length);
    for (const a of keys) for (const b of keys) if (a !== b) expect(a.includes(b), `'${a}' vs '${b}'`).toBe(false);
  });

  it("trains the full body, majors on at least two days", () => {
    const weekly = MachineWeek.weeklySets();
    for (const g of allGroups) expect(weekly[g] ?? 0, g).toBeGreaterThan(0);
    expect(Object.keys(weekly).filter((g) => !allGroups.includes(g))).toEqual([]);
    for (const g of majors) {
      const days = MachineWeek.DAYS.filter((d) => d.slots.some((s) => s.group === g)).length;
      expect(days, g).toBeGreaterThanOrEqual(2);
      expect(weekly[g]).toBeGreaterThanOrEqual(8);
      expect(weekly[g]).toBeLessThanOrEqual(22);
    }
  });

  it("never hits a major muscle hard on back-to-back days; exactly one light day", () => {
    const days = MachineWeek.DAYS;
    days.forEach((today, i) => {
      const tomorrow = days[(i + 1) % days.length];
      if (today.light || tomorrow.light) return;
      const shared = today.slots
        .map((s) => s.group)
        .filter((g) => majors.includes(g) && tomorrow.slots.some((s) => s.group === g));
      expect(shared, `${today.weekday}→${tomorrow.weekday}`).toEqual([]);
    });
    expect(days.filter((d) => d.light)).toHaveLength(1);
  });

  it("keeps Sunday light, in straight sets, with normal-effort calves and woodchops", () => {
    const sunday = MachineWeek.day("SUNDAY");
    expect(sunday.light).toBe(true);
    expect(sunday.slots.some((s) => s.supersetWithNext)).toBe(false);
    expect(sunday.slots.filter((s) => s.easy === false).map((s) => s.machine)).toEqual([
      "Calf Press",
      "Cable Woodchop"
    ]);
  });

  it("picks the day from the calendar date", () => {
    expect(MachineWeek.dayFor("2026-11-02").weekday).toBe("MONDAY");
    expect(MachineWeek.dayFor("2026-11-01").weekday).toBe("SUNDAY");
    expect(MachineWeek.dayFor("2026-11-07").weekday).toBe("SATURDAY");
    expect(MachineWeek.dayFor("2026-11-03T23:30:00Z").weekday).toBe("TUESDAY");
  });

  it("round-trips the plan id", () => {
    expect(MachineWeek.planId("MONDAY")).toBe("machine-week:MONDAY");
    expect(MachineWeek.weekdayOf("machine-week:FRIDAY")).toBe("FRIDAY");
    expect(MachineWeek.weekdayOf("machine-week:FUNDAY")).toBeUndefined();
    expect(MachineWeek.weekdayOf("day-1")).toBeUndefined();
    expect(MachineWeek.weekdayOf(undefined)).toBeUndefined();
    expect(MachineWeek.isMachineWeek({ presetId: "machine-week:SUNDAY" })).toBe(true);
    expect(MachineWeek.isMachineWeek({ presetId: "day-1" })).toBe(false);
  });

  it("gives every machine cues and its own how-to video", () => {
    for (const m of MachineWeek.MACHINES) {
      expect(m.setup && m.cues && m.mistake, m.name).toBeTruthy();
      expect(m.video, `${m.name} has no how-to video`).toBeDefined();
      expect(m.video!.id, m.name).toMatch(/^[A-Za-z0-9_-]{11}$/);
      expect(m.videoUrl.startsWith(`https://www.youtube.com/watch?v=${m.video!.id}`), m.name).toBe(true);
      expect(m.instructions.startsWith(`Setup: ${m.setup}\nForm: ${m.cues}\nAvoid: ${m.mistake}`)).toBe(true);
    }
    const ids = MachineWeek.MACHINES.map((m) => `${m.video!.id}@${m.video!.startSec}`);
    expect(new Set(ids).size).toBe(ids.length);
    expect(MachineWeek.find("Rear Delt Fly")!.videoUrl).toBe("https://www.youtube.com/watch?v=PvakIGAH8Ss&t=171s");
    expect(MachineWeek.find("Seated Chest Press")!.instructions).toContain(
      "\nBusy? Hammer Strength Chest Press or Cable Chest Press"
    );
  });

  it("jumps the video link to the start time", () => {
    expect(howToVideoUrl({ id: "abcdefghijk", startSec: 0 })).toBe("https://www.youtube.com/watch?v=abcdefghijk");
    expect(howToVideoUrl({ id: "abcdefghijk", startSec: 75 })).toBe(
      "https://www.youtube.com/watch?v=abcdefghijk&t=75s"
    );
  });

  it("uses the Android load steps", () => {
    expect(MACHINE_LOAD_STEP_LBS).toEqual({ Standard: 10, LegPress: 20, Small: 5, Assisted: 10 });
    expect(MachineWeek.find("Leg Press")!.load).toBe("LegPress");
    expect(MachineWeek.find("Assisted Chin-Up")!.load).toBe("Assisted");
    expect(MachineWeek.find("Cable Lateral Raise")!.load).toBe("Small");
  });
});

/* ------------------------------------------------------------ progression -- */

describe("machine week: progression", () => {
  it("asks for a pin the first time", () => {
    const p = MachineWeek.prescribe(slotFor("Standard"), []);
    expect(p.weightLbs).toBeUndefined();
    expect(p.reps).toBe(12);
    expect(p.note).toContain("First time");
    expect(p.scheme).toBe("3 sets of 8–12; rest 90 s");
  });

  it("moves up one pin when every set hits the top of the range", () => {
    const slot = slotFor("Standard");
    // One logged set isn't "every set": stay on the pin until all 3 reach the top.
    const one = MachineWeek.prescribe(slot, [strength("2026-10-26", [slot.machine, 100, 12])]);
    expect(one.weightLbs).toBe(100);
    expect(one.note).toContain("do all 3 sets");
    const p = MachineWeek.prescribe(slot, [strength("2026-10-26", [slot.machine, 100, 12], [slot.machine, 100, 12], [slot.machine, 100, 12])]);
    expect(p.weightLbs).toBe(110);
    expect(p.reps).toBe(8);
    const all = MachineWeek.prescribe(slot, [
      sets("2026-10-26", "Monday", slot.machine, [100, 12], [100, 12], [100, 12])
    ]);
    expect(all.weightLbs).toBe(110);
    expect(all.note).toContain("Hit every set at 100 lb");
  });

  it("jumps the leg press 20 lb", () => {
    const slot = slotFor("LegPress");
    const p = MachineWeek.prescribe(slot, [strength("2026-10-26", [slot.machine, 200, 12], [slot.machine, 200, 12], [slot.machine, 200, 12])]);
    expect(p.weightLbs).toBe(220);
  });

  it("adds a rep on the same pin inside the range", () => {
    const slot = slotFor("Standard");
    const p = MachineWeek.prescribe(slot, [strength("2026-10-26", [slot.machine, 100, 9])]);
    expect(p.weightLbs).toBe(100);
    expect(p.reps).toBe(10);
  });

  it("stays on the pin when the sets fade", () => {
    const slot = slotFor("Standard");
    const fading = MachineWeek.prescribe(slot, [
      sets("2026-10-26", "Monday", slot.machine, [100, 12], [100, 10], [100, 9])
    ]);
    expect(fading.weightLbs).toBe(100);
    expect(fading.reps).toBe(10);
    expect(fading.note).toContain("every set");
  });

  it("stays on the pin after one miss below the range", () => {
    const slot = slotFor("Standard");
    const p = MachineWeek.prescribe(slot, [strength("2026-10-26", [slot.machine, 100, 6])]);
    expect(p.weightLbs).toBe(100);
    expect(p.reps).toBe(8);
    expect(p.note).toContain("stay on that pin");
  });

  it("goes one pin easier after two misses at the same pin", () => {
    const slot = slotFor("Standard");
    const p = MachineWeek.prescribe(slot, [
      strength("2026-10-26", [slot.machine, 100, 6]),
      strength("2026-10-19", [slot.machine, 100, 7])
    ]);
    expect(p.weightLbs).toBe(90);
    expect(p.reps).toBe(12);
  });

  it("never calls the lightest pin 'easier'", () => {
    const slot: MachineSlot = { ...slotFor("Small"), machine: "Rear Delt Fly", group: "Rear delts", low: 10, high: 15, restSec: 60 };
    const p = MachineWeek.prescribe(slot, [
      sets("2026-10-27", "Tuesday", slot.machine, [5, 7]),
      sets("2026-10-20", "Tuesday", slot.machine, [5, 6])
    ]);
    expect(p.weightLbs).toBe(5);
    expect(p.note).toContain("lightest pin");
    expect(p.note).not.toContain("easier");
  });

  it("takes help away on assisted machines", () => {
    const slot = slotFor("Assisted");
    const p = MachineWeek.prescribe(slot, [strength("2026-10-26", [slot.machine, 90, 12], [slot.machine, 90, 12], [slot.machine, 90, 12])]);
    expect(p.weightLbs).toBe(80);
    expect(p.note).toContain("less help");
  });

  it("never prescribes zero help", () => {
    const slot = slotFor("Assisted");
    const p = MachineWeek.prescribe(slot, [sets("2026-10-26", "Tuesday", slot.machine, [10, 12], [10, 12], [10, 12])]);
    expect(p.weightLbs).toBe(10);
    expect(p.note).toContain("unassisted");
  });

  it("reads the least help as the assisted working pin", () => {
    const slot = slotFor("Assisted");
    const p = MachineWeek.prescribe(slot, [
      sets("2026-10-26", "Tuesday", slot.machine, [60, 9], [60, 8], [70, 8])
    ]);
    expect(p.weightLbs).toBe(60);
    expect(p.reps).toBe(9);
  });

  it("adds help after two tough assisted sessions", () => {
    const slot = slotFor("Assisted");
    const p = MachineWeek.prescribe(slot, [
      sets("2026-10-26", "Tuesday", slot.machine, [40, 5]),
      sets("2026-10-19", "Tuesday", slot.machine, [40, 6])
    ]);
    expect(p.weightLbs).toBe(50);
    expect(p.note).toContain("add one pin of help");
  });

  it("ignores free-weight logs from other plans", () => {
    const slot = MachineWeek.day("MONDAY").slots.find((s) => s.machine === "Machine Triceps Extension")!;
    const p = MachineWeek.prescribe(slot, [
      sets("2026-10-26", "Vinny", "Dumbbell Overhead Triceps Extension", [25, 10]),
      sets("2026-10-25", "Vinny", "Back Extension (45°)", [45, 12])
    ]);
    expect(p.weightLbs).toBeUndefined();
    expect(p.note).toContain("First time");
  });

  it("always shows the weight once in the scheme", () => {
    // Rest 120 s and a 120 lb pin: the "120" in the rest text must not hide the weight.
    const slot = MachineWeek.day("MONDAY").slots[0];
    const p = MachineWeek.prescribe(slot, [sets("2026-10-26", "Monday", slot.machine, [120, 10])]);
    const line = MachineWeek.formatLine(p);
    expect(line).toBe("Chest · Seated Chest Press — 3 sets of 8–12 @ 120 lb; rest 120 s");
    expect(line.match(/@ 120 lb/g)).toHaveLength(1);
    expect(MachineWeek.scheme(MachineWeek.day("MONDAY").slots[3], 30)).toBe(
      "3 sets of 10–15 @ 30 lb; rest 60 s; superset: go straight to the next machine"
    );
  });

  it("keeps the light day easy except calves and woodchops", () => {
    const log = [strength("2026-10-28", ["Leg Press", 200, 10], ["Calf Press", 150, 15])];
    const session = MachineWeek.buildSession(profile, log, "2026-11-01");
    const legPress = session.prescriptions.find((p) => p.exercise === "Leg Press")!;
    const calves = session.prescriptions.find((p) => p.exercise === "Calf Press")!;
    expect(legPress.weightLbs).toBe(160); // ~80% of the last hard pin
    expect(legPress.note).toContain("Light day");
    expect(calves.weightLbs).toBe(150); // normal effort: same pin, add a rep
    expect(calves.reps).toBe(16);
  });

  it("never moves a pin up from a light session", () => {
    const slot = MachineWeek.day("WEDNESDAY").slots.find((s) => s.machine === "Leg Press")!;
    const p = MachineWeek.prescribe(slot, [
      { ...strength("2026-11-01", ["Leg Press", 160, 12]), title: SUNDAY_TITLE },
      strength("2026-10-31", ["Leg Press", 200, 10])
    ]);
    expect(p.weightLbs).toBe(200);
    expect(p.reps).toBe(11);
  });

  it("counts Sunday's woodchops and calves toward their own progress, but not Sunday's leg press", () => {
    const log = [sets("2026-11-01", SUNDAY_TITLE, "Cable Woodchop", [30, 15], [30, 15])];
    const woodchop = MachineWeek.buildSession(profile, log, "2026-11-08").prescriptions.find(
      (p) => p.exercise === "Cable Woodchop"
    )!;
    expect(woodchop.weightLbs).toBe(30);
    expect(woodchop.reps).toBe(16);
    expect(woodchop.note).not.toContain("First time");

    const calfLog = [sets("2026-11-01", SUNDAY_TITLE, "Calf Press", [150, 20], [150, 20], [150, 20])];
    const friday = MachineWeek.day("FRIDAY").slots.find((s) => s.machine === "Calf Press")!;
    expect(MachineWeek.prescribe(friday, calfLog).weightLbs).toBe(170); // every set at the top → +20

    expect(MachineWeek.isLightSession(log[0], "Leg Press")).toBe(true);
    expect(MachineWeek.isLightSession(log[0], "Cable Woodchop")).toBe(false);
    expect(MachineWeek.isLightSession(log[0], "Calf Press")).toBe(false);
    expect(MachineWeek.isLightSession(log[0])).toBe(true);

    const legPress = MachineWeek.day("WEDNESDAY").slots.find((s) => s.machine === "Leg Press")!;
    const sundayOnly = [sets("2026-11-01", SUNDAY_TITLE, "Leg Press", [160, 12], [160, 12], [160, 12])];
    expect(MachineWeek.prescribe(legPress, sundayOnly).weightLbs).toBeUndefined(); // still a first time
  });

  it("keeps swaps logged on the light day out of hard history", () => {
    // Hack Squat isn't a Sunday slot: logged on Sunday (as the leg-press swap) it's easy work.
    const sundaySwap = sets("2026-11-01", SUNDAY_TITLE, "Hack Squat", [140, 12], [140, 12], [140, 12]);
    expect(MachineWeek.isLightSession(sundaySwap, "Hack Squat")).toBe(true);
    const hackSquat: MachineSlot = { ...slotFor("LegPress"), machine: "Hack Squat" };
    expect(MachineWeek.prescribe(hackSquat, [sundaySwap]).weightLbs).toBeUndefined();
    // …but it still seeds a light-day pin.
    expect(MachineWeek.prescribe(hackSquat, [sundaySwap], true).weightLbs).toBe(140);
  });

  it("merges two logs on one day into one session, in recordedAt order", () => {
    const slot = slotFor("Standard");
    const first = { ...sets("2026-10-26", "Monday", slot.machine, [100, 12], [100, 12]), id: "a", recordedAt: "2026-10-26T12:00:00Z" };
    const reopened = { ...sets("2026-10-26", "Monday", slot.machine, [100, 12]), id: "b", recordedAt: "2026-10-26T12:40:00Z" };
    // Three sets at the top across the two saves → one pin up.
    const p = MachineWeek.prescribe(slot, [reopened, first]);
    expect(p.weightLbs).toBe(110);
    expect(p.note).toContain("Hit every set at 100 lb");
    expect(MachineWeek.loggerHistory(slot.machine, [reopened, first])).toHaveLength(1);
  });

  it("doesn't move up after dropping the pin mid-session", () => {
    const slot = slotFor("Standard");
    const p = MachineWeek.prescribe(slot, [
      sets("2026-10-26", "Monday", slot.machine, [100, 12], [100, 12], [90, 12])
    ]);
    expect(p.weightLbs).toBe(100);
    expect(p.reps).toBe(12);
    expect(p.note).toContain(
      "Did 12/12 at 100 lb — same pin; do all 3 sets at 100 lb with 12 reps before moving up."
    );
    // The drop can come from a second save later that day.
    const early = { ...sets("2026-10-26", "Monday", slot.machine, [100, 12], [100, 12]), id: "a", recordedAt: "2026-10-26T12:00:00Z" };
    const late = { ...sets("2026-10-26", "Monday", slot.machine, [90, 12]), id: "b", recordedAt: "2026-10-26T12:30:00Z" };
    const merged = MachineWeek.prescribe(slot, [late, early]);
    expect(merged.weightLbs).toBe(100);
    expect(merged.note).toContain("do all 3 sets");
  });

  it("ignores warm-up sets logged after the working sets ('+ Set' adds rows at the end)", () => {
    const slot = MachineWeek.day("MONDAY").slots[0]; // Seated Chest Press, 3 × 8–12
    const p = MachineWeek.prescribe(slot, [
      sets("2026-10-26", "Monday", slot.machine, [120, 12], [120, 12], [120, 12], [60, 10], [85, 5])
    ]);
    expect(p.weightLbs).toBe(130);
    expect(p.reps).toBe(8);
  });

  it("treats a lighter set before the pin as a warm-up, not a drop", () => {
    const slot = slotFor("Standard");
    const p = MachineWeek.prescribe(slot, [
      sets("2026-10-26", "Monday", slot.machine, [80, 10], [100, 12], [100, 12], [100, 12])
    ]);
    expect(p.weightLbs).toBe(110);
    // Order comes from recordedAt, not the array order.
    const warmup = { ...sets("2026-10-26", "Monday", slot.machine, [90, 12]), id: "a", recordedAt: "2026-10-26T11:00:00Z" };
    const work = { ...sets("2026-10-26", "Monday", slot.machine, [100, 12], [100, 12], [100, 12]), id: "b", recordedAt: "2026-10-26T12:00:00Z" };
    expect(MachineWeek.prescribe(slot, [work, warmup]).weightLbs).toBe(110);
  });

  it("doesn't take help away after an assisted drop to more help", () => {
    const slot = slotFor("Assisted");
    const p = MachineWeek.prescribe(slot, [sets("2026-10-26", "Tuesday", slot.machine, [40, 12], [40, 12], [50, 12])]);
    expect(p.weightLbs).toBe(40);
    expect(p.note).toContain("do all 3 sets");
  });

  it("lands light-day loads on real pins", () => {
    const log = [
      sets("2026-10-31", "Saturday", "Leg Press", [220, 10]),
      sets("2026-10-26", "Monday", "Seated Chest Press", [120, 10])
    ];
    const session = MachineWeek.buildSession(profile, log, "2026-11-01");
    const legPress = session.prescriptions.find((p) => p.exercise === "Leg Press")!.weightLbs!;
    const chest = session.prescriptions.find((p) => p.exercise === "Seated Chest Press")!.weightLbs!;
    expect(legPress % MACHINE_LOAD_STEP_LBS.LegPress).toBe(0);
    expect(chest % MACHINE_LOAD_STEP_LBS.Standard).toBe(0);
    expect(legPress).toBeLessThan(220);
    expect(chest).toBeLessThan(120);
  });

  it("gives the assisted machine more help on a light day", () => {
    const slot = slotFor("Assisted");
    const p = MachineWeek.prescribe(slot, [strength("2026-10-26", [slot.machine, 50, 10])], true);
    expect(p.weightLbs).toBe(60);
    expect(p.note).toContain("a bit more help");
  });
});

/* ------------------------------------------------- logger history + PRs -- */

describe("machine week: logger history + records", () => {
  it("maps exact-name pin history to exercise sessions", () => {
    const log = [
      sets("2026-10-26", "Monday", "Seated Chest Press", [100, 12], [100, 10], [90, 12]),
      sets("2026-10-19", "Monday", "Seated Chest Press", [90, 11]),
      sets("2026-10-25", "Vinny", "Seated Chest Press Machine", [150, 5])
    ];
    expect(MachineWeek.loggerHistory("Seated Chest Press", log)).toEqual([
      { date: "2026-10-26", topWeightLbs: 100, topReps: 12, setCount: 2, e1Rm: 140 },
      { date: "2026-10-19", topWeightLbs: 90, topReps: 11, setCount: 1, e1Rm: 123 }
    ]);
  });

  it("gives assisted machines no e1RM", () => {
    const log = [sets("2026-10-27", "Tuesday", "Assisted Chin-Up", [50, 8], [40, 6])];
    expect(MachineWeek.loggerHistory("Assisted Chin-Up", log)).toEqual([
      { date: "2026-10-27", topWeightLbs: 40, topReps: 6, setCount: 1, e1Rm: undefined }
    ]);
    expect(MachineWeek.isAssisted("Assisted Chin-Up")).toBe(true);
    expect(MachineWeek.isAssisted("assisted dip")).toBe(true);
    expect(MachineWeek.isAssisted("Lat Pulldown")).toBe(false);
    expect(MachineWeek.isAssisted("Assisted Dip Machine")).toBe(false); // exact names only
  });

  it("never calls more help an assisted weight or e1RM record", () => {
    const before = [sets("2026-10-20", "Tuesday", "Assisted Dip", [40, 10])];
    const moreHelp = sets("2026-10-27", "Tuesday", "Assisted Dip", [60, 10], [40, 12]);
    const records = detectNewRecords(before, moreHelp);
    expect(records.map((r) => r.kind)).toEqual(["reps"]); // 12 reps at the 40 lb pin still counts
    expect(records[0]).toMatchObject({ exercise: "Assisted Dip", value: 12, previousValue: 10, weightLbs: 40 });

    // Regular machines keep weight + e1RM records.
    const chestBefore = [sets("2026-10-19", "Monday", "Seated Chest Press", [100, 10])];
    const chest = sets("2026-10-26", "Monday", "Seated Chest Press", [110, 10]);
    expect(detectNewRecords(chestBefore, chest).map((r) => r.kind)).toEqual(["weight", "e1rm"]);
  });
});

/* ---------------------------------------------------------------- session -- */

describe("machine week: session + plan", () => {
  const catalog = buildWorkoutCatalog();

  it("builds today's session with title, summary and tip", () => {
    const s = MachineWeek.buildSession(profile, [], "2026-11-02");
    expect(s.title).toBe("Monday · Push A: Chest Focus");
    expect(s.swapped).toBe(false);
    expect(s.prescriptions).toHaveLength(7);
    expect(s.summary).toBe(
      "Monday · Push A: Chest Focus: 7 machines, 18 working sets, about 45 min. First run — log each pin so the app can move you up."
    );
    expect(s.tip.startsWith("Warm-up: 2 ramp sets on the Seated Chest Press")).toBe(true);
    expect(s.tip).toContain("Past 45 min?");
    const sunday = MachineWeek.buildSession(profile, [], "2026-11-01");
    expect(sunday.tip).toContain("Light day: end every set with 3–4 good reps left");
  });

  it("returns the machine day from buildProgressivePlan for machine_week", () => {
    const plan = buildProgressivePlan(profile, [], "2026-11-03", "2026-11-03T07:00:00Z");
    const item = plan.items.find((i) => i.bucket === "strength")!;
    expect(MachineWeek.isMachineWeek(item)).toBe(true);
    expect(MachineWeek.weekdayOf(item.presetId)).toBe("TUESDAY");
    expect(item.kind).toBe("custom");
    expect(item.variant).toBe("Machine");
    expect(item.title.startsWith("Tuesday")).toBe(true);
    expect(item.prescriptions).toHaveLength(MachineWeek.day("TUESDAY").slots.length);
    expect(item.exercises).toEqual(item.prescriptions!.map(MachineWeek.formatLine));
    expect(item.rationale).toBe(MachineWeek.day("TUESDAY").focus);
    expect(item.description).toContain("Warm-up:");
    expect(item.progressionSummary).toContain("Tuesday · Pull A: Lats & Abs");
    expect(item.estMinutes).toBeGreaterThanOrEqual(43);
    expect(item.estMinutes).toBeLessThanOrEqual(47);
    // No free weights anywhere in the strength item.
    expect(JSON.stringify(item)).not.toMatch(/barbell|dumbbell|kettlebell/i);
    // The other buckets stay as before.
    expect(plan.items.map((i) => i.bucket)).toEqual(["strength", "cardio", "martial_arts"]);
  });

  it("uses the logged pins in the plan", () => {
    const log = [
      strength(
        "2026-10-27",
        ["Hammer Strength Front Pulldown", 100, 12],
        ["Hammer Strength Front Pulldown", 100, 12],
        ["Hammer Strength Front Pulldown", 100, 12],
        ["Seated Row", 90, 10]
      )
    ];
    const plan = buildProgressivePlan(profile, log, "2026-11-03", "2026-11-03T07:00:00Z");
    const item = plan.items.find((i) => i.bucket === "strength")!;
    const pulldown = item.prescriptions!.find((p) => p.exercise === "Hammer Strength Front Pulldown")!;
    expect(pulldown.weightLbs).toBe(110);
    expect(item.exercises![0]).toBe("Back · Hammer Strength Front Pulldown — 3 sets of 8–12 @ 110 lb; rest 120 s");
    expect(item.progressionSummary).toContain("Weights come from your log");
  });

  it("labels a swapped day", () => {
    const item = machineWeekSuggestion(profile, [], "2026-11-02", "THURSDAY");
    expect(MachineWeek.weekdayOf(item.presetId)).toBe("THURSDAY");
    expect(item.title).toBe("Thursday's Push B: Shoulders & Chest (swapped in)");
    expect(item.rationale.startsWith("Swapped in for today.")).toBe(true);
  });

  it("survives the plan parser and guard unchanged (sync/AI round trip)", () => {
    const plan = buildProgressivePlan(profile, [], "2026-11-04", "2026-11-04T07:00:00Z");
    const json = JSON.parse(JSON.stringify(plan)) as unknown;
    expect(isDailyWorkoutPlan(json)).toBe(true);
    const back = parseDailyWorkoutPlan(json, catalog, "2026-11-04", "2026-11-04T07:00:00Z", "computed");
    const before = plan.items.find((i) => i.bucket === "strength")!;
    const after = back.items.find((i) => i.bucket === "strength")!;
    expect(MachineWeek.weekdayOf(after.presetId)).toBe("WEDNESDAY");
    expect(after.prescriptions).toEqual(before.prescriptions);
  });

  it("leaves the other coach styles alone", () => {
    const vinny = buildProgressivePlan(defaultTrainingProfile(NOW), [], "2026-11-03", NOW);
    expect(MachineWeek.isMachineWeek(vinny.items[0])).toBe(false);
    expect(vinny.items[0].title).toContain("Vinny split");
    const simple = buildProgressivePlan(
      { ...defaultTrainingProfile(NOW), coachStyle: "simple_progressive" },
      [],
      "2026-11-03",
      NOW
    );
    expect(simple.items[0].title).toContain("simple progression");
  });

  it("feeds the AI today's exact machine session with last-session numbers", () => {
    const log = [sets("2026-10-27", "Tuesday", "Seated Row", [90, 10], [90, 9])];
    const ctx = MachineWeek.buildProgressionContext(profile, log, "2026-11-03");
    const lines = ctx.split("\n");
    expect(lines[0]).toBe(
      "Planet Fitness machine week (machines and cables only, no free weights). Today: Tuesday · Pull A: Lats & Abs, ~46 min."
    );
    expect(lines[1]).toBe(
      "Week: Mon Push A: Chest Focus · Tue Pull A: Lats & Abs · Wed Legs A: Quads & Hips · Thu Push B: Shoulders & Chest · Fri Pull B: Mid-Back & Arms · Sat Legs B: Hamstrings & Glutes · Sun Full-Body Light: Hips & Core"
    );
    expect(lines).toContain("- Back · Seated Row — 3 sets of 8–12 @ 90 lb; rest 90 s (last 2026-10-27: 90 lb × 10/9)");
    expect(lines).toContain("- Back · Hammer Strength Front Pulldown — 3 sets of 8–12; rest 120 s (no log yet)");
    expect(lines).toHaveLength(2 + MachineWeek.day("TUESDAY").slots.length);
  });
});

/* ---------------------------------------------------- client + AI wiring -- */

describe("machine week: client plan + AI", () => {
  const originalKey = process.env.OPENAI_API_KEY;

  beforeEach(() => {
    window.localStorage.clear();
    saveTrainingProfile(window.localStorage, profile);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    window.localStorage.clear();
    resetRateLimiter();
    resetCoachModelFallbackForTests();
    setWorkoutCoachForTests(undefined);
    process.env.OPENAI_API_KEY = originalKey;
  });

  function aiBarbellPlan(date: string): DailyWorkoutPlan {
    return {
      date,
      items: [
        {
          bucket: "strength",
          kind: "custom",
          title: "Squat day",
          rationale: "Barbell time.",
          prescriptions: [{ exercise: "Barbell Back Squat", sets: 5, reps: 5, weightLbs: 185 }]
        },
        { bucket: "cardio", kind: "custom", title: "Easy bike", rationale: "Spin it out.", estMinutes: 20 }
      ],
      note: "AI plan",
      source: "ai",
      createdAt: NOW
    };
  }

  it("sends the machine-week progression context", () => {
    const date = toLocalIsoDate();
    const ctx = buildWorkoutContext(window.localStorage, date);
    expect(ctx.profile.coachStyle).toBe("machine_week");
    expect(ctx.progressionSummary).toBe(MachineWeek.buildProgressionContext(profile, [], date));
    expect(ctx.progressionSummary).not.toContain("Next focus in the rotation");
  });

  it("keeps the programmed machine day over the AI's strength item", async () => {
    const date = toLocalIsoDate();
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(aiBarbellPlan(date)), { status: 200, headers: { "Content-Type": "application/json" } })
    );
    vi.stubGlobal("fetch", fetchMock);

    const plan = await getOrComputeWorkoutPlan(window.localStorage);
    const sent = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string) as Record<string, unknown>;
    expect(sent.coachStyle).toBe("machine_week");
    expect(String(sent.progressionSummary)).toContain("Planet Fitness machine week");

    const strengthItem = plan.items.find((i) => i.bucket === "strength")!;
    expect(strengthItem.presetId).toBe(MachineWeek.planId(MachineWeek.dayFor(date).weekday));
    expect(strengthItem.prescriptions!.some((p) => /barbell/i.test(p.exercise))).toBe(false);
    // The AI still tailors the optional buckets.
    expect(plan.items.find((i) => i.bucket === "cardio")!.title).toBe("Easy bike");
    expect(plan.source).toBe("ai");

    // Swap cycles to the next weekday's machine session.
    const swapped = swapBucketPreset(window.localStorage, plan, "strength");
    const next = swapped.items.find((i) => i.bucket === "strength")!;
    const today = MachineWeek.dayFor(date).weekday;
    const tomorrow = weekdays[(weekdays.indexOf(today) + 1) % 7];
    expect(MachineWeek.weekdayOf(next.presetId)).toBe(tomorrow);
    expect(next.title).toContain("(swapped in)");
    expect(swapped.items.find((i) => i.bucket === "cardio")!.title).toBe("Easy bike");
  });

  it("still lets the AI replace the strength item for other coach styles", async () => {
    saveTrainingProfile(window.localStorage, { ...profile, coachStyle: "simple_progressive" });
    const date = toLocalIsoDate();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(JSON.stringify(aiBarbellPlan(date)), { status: 200 }))
    );
    const plan = await getOrComputeWorkoutPlan(window.localStorage);
    expect(plan.items.find((i) => i.bucket === "strength")!.title).toBe("Squat day");
  });

  it("forwards coachStyle machine_week through the route", async () => {
    let received: WorkoutSuggestionInput | undefined;
    setWorkoutCoachForTests(async (input) => {
      received = input;
      return { date: input.date, items: [], source: "ai", createdAt: NOW };
    });
    const res = await POST(
      new Request("http://localhost/api/ai/workout-suggestion", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ date: "2026-11-03", coachStyle: "machine_week" })
      })
    );
    expect(res.status).toBe(200);
    expect(received?.coachStyle).toBe("machine_week");
  });

  it("puts the machine-week guide (and nothing else's) in the coach prompt", async () => {
    process.env.OPENAI_API_KEY = "sk-test";
    const reply = { items: [{ bucket: "cardio", kind: "preset", presetId: "walk", title: "Walk", rationale: "" }] };
    const fetchMock = vi.fn().mockImplementation(
      async () =>
        new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify(reply) } }] }), {
          status: 200,
          headers: { "Content-Type": "application/json" }
        })
    );
    vi.stubGlobal("fetch", fetchMock);
    const userPrompt = (call: number): string => {
      const body = JSON.parse((fetchMock.mock.calls[call][1] as RequestInit).body as string) as {
        messages: { role: string; content: string }[];
      };
      return body.messages.find((m) => m.role === "user")!.content;
    };

    await suggestDailyWorkoutPlan({
      date: "2026-11-03",
      coachStyle: "machine_week",
      progressionSummary: MachineWeek.buildProgressionContext(profile, [], "2026-11-03")
    });
    const machine = userPrompt(0);
    expect(machine).toContain(machineWeekStyleGuide);
    expect(machine).toContain("do NOT contradict them");
    expect(machine).not.toContain("VINNY SPLIT");

    await suggestDailyWorkoutPlan({ date: "2026-11-03", coachStyle: "simple_progressive", progressionSummary: "x" });
    const simple = userPrompt(1);
    expect(simple).not.toContain("PLANET FITNESS MACHINE WEEK");
    expect(simple).not.toContain("do NOT contradict them");
  });
});
