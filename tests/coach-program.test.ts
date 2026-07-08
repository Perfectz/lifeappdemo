import { describe, expect, it } from "vitest";

import {
  buildVinnyProgressionContext,
  buildVinnySession,
  formatVinnyPrescriptionLine,
  nextVinnyDay,
  trippleLadderLbs,
  vinnyDayOfWorkout,
  vinnyFewShotExamples,
  vinnyStyleGuide
} from "@/domain/coachProgram";
import { defaultTrainingProfile } from "@/domain/trainingProfile";
import {
  buildProgressivePlan,
  buildWorkoutCatalog,
  parseDailyWorkoutPlan
} from "@/domain/workoutPlan";
import type { StrengthSet, Workout } from "@/domain/types";

const NOW = "2026-07-07T10:00:00.000Z";
const DATE = "2026-07-07";
const profile = defaultTrainingProfile(NOW);

function strengthWorkout(date: string, sets: StrengthSet[], title = "Session"): Workout {
  return {
    id: `w-${date}-${title}`,
    date,
    type: "strength",
    source: "manual",
    title,
    sets,
    recordedAt: NOW,
    createdAt: NOW,
    updatedAt: NOW
  };
}

function vinnyA(date: string, sets: StrengthSet[] = []): Workout {
  return strengthWorkout(date, sets, "Chest and Bis — Vinny split");
}

function vinnyB(date: string, sets: StrengthSet[] = []): Workout {
  return strengthWorkout(date, sets, "Back and Shoulders — Vinny split");
}

describe("default coach style", () => {
  it("defaults the training profile to vinny_split", () => {
    expect(profile.coachStyle).toBe("vinny_split");
  });
});

describe("A/B alternation", () => {
  it("starts on Day A with no Vinny history", () => {
    expect(nextVinnyDay([])).toBe("A");
    expect(buildVinnySession({ profile, workouts: [] }).day).toBe("A");
  });

  it("alternates off the most recent Vinny session", () => {
    expect(nextVinnyDay([vinnyA("2026-07-05")])).toBe("B");
    expect(nextVinnyDay([vinnyA("2026-07-03"), vinnyB("2026-07-05")])).toBe("A");
    // Non-Vinny strength days (e.g. a simple-progressive squat day) are ignored.
    expect(
      nextVinnyDay([vinnyA("2026-07-03"), strengthWorkout("2026-07-05", [], "Squat day")])
    ).toBe("B");
  });

  it("recognizes both day titles, including the Chest and Arms variant", () => {
    expect(vinnyDayOfWorkout(vinnyA("2026-07-05"))).toBe("A");
    expect(vinnyDayOfWorkout(vinnyB("2026-07-05"))).toBe("B");
    expect(vinnyDayOfWorkout(strengthWorkout("2026-07-05", [], "Chest and Arms"))).toBe("A");
    expect(vinnyDayOfWorkout(strengthWorkout("2026-07-05", [], "Leg day"))).toBeUndefined();
  });

  it("honors an explicit focusDay override", () => {
    expect(buildVinnySession({ profile, workouts: [], focusDay: "B" }).day).toBe("B");
  });
});

describe("main-lift ascending triples", () => {
  it("progresses the top triple +5 on bench after 4 completed triples, rungs at 70/80/90% rounded to 5", () => {
    const history = [
      strengthWorkout("2026-07-04", [
        { exercise: "Incline Barbell Bench Press", reps: 3, weightLbs: 130 },
        { exercise: "Incline Barbell Bench Press", reps: 3, weightLbs: 150 },
        { exercise: "Incline Barbell Bench Press", reps: 3, weightLbs: 165 },
        { exercise: "Incline Barbell Bench Press", reps: 3, weightLbs: 180 }
      ])
    ];
    const session = buildVinnySession({ profile, workouts: history });
    const main = session.prescriptions[0];
    expect(main.exercise).toBe("Incline Barbell Bench Press");
    expect(main).toMatchObject({ sets: 4, reps: 3, weightLbs: 185, group: "Chest" });
    expect(main.scheme).toBe("1 warm-up, then 4 sets increasing weight — triples: 130/150/165/185");
    expect(session.summary).toContain("185");
  });

  it("progresses a deadlift top triple +10 (barbell lower body)", () => {
    const history = [
      strengthWorkout("2026-07-04", [{ exercise: "Rack Deadlifts", reps: 3, weightLbs: 275 }])
    ];
    const session = buildVinnySession({ profile, workouts: history, focusDay: "B" });
    const main = session.prescriptions[0];
    expect(main.exercise).toBe("Rack Deadlifts");
    expect(main.weightLbs).toBe(285);
    expect(main.scheme).toContain("triples: 200/230/255/285");
  });

  it("repeats the top triple after a miss and deloads 10% after two misses", () => {
    const miss1 = [
      strengthWorkout("2026-07-04", [{ exercise: "Incline Barbell Bench Press", reps: 2, weightLbs: 180 }])
    ];
    expect(buildVinnySession({ profile, workouts: miss1 }).prescriptions[0].weightLbs).toBe(180);

    const miss2 = [
      ...miss1,
      strengthWorkout("2026-07-01", [{ exercise: "Incline Barbell Bench Press", reps: 2, weightLbs: 180 }])
    ];
    const deloaded = buildVinnySession({ profile, workouts: miss2 }).prescriptions[0];
    expect(deloaded.weightLbs).toBe(160); // 180 × 0.9 → 162 → rounded to 160
    expect(deloaded.note).toMatch(/deload/i);
  });

  it("mentions the best recent e1RM in the main-lift note when history exists", () => {
    const history = [
      strengthWorkout("2026-07-04", [{ exercise: "Incline Barbell Bench Press", reps: 3, weightLbs: 180 }])
    ];
    const main = buildVinnySession({ profile, workouts: history }).prescriptions[0];
    expect(main.note).toMatch(/e1RM ~\d+ lb/);
  });

  it("leaves the load open with no history but keeps the triples scheme", () => {
    const main = buildVinnySession({ profile, workouts: [] }).prescriptions[0];
    expect(main.weightLbs).toBeUndefined();
    expect(main.scheme).toMatch(/4 sets increasing weight \(triples\)/i);
  });

  it("computes the ladder rounded to 5", () => {
    expect(trippleLadderLbs(185)).toEqual([130, 150, 165, 185]);
    expect(trippleLadderLbs(285)).toEqual([200, 230, 255, 285]);
  });
});

describe("session structure", () => {
  it("Day A runs Chest(3) → Tris(3) → Bis(3) with schemes on every line", () => {
    const session = buildVinnySession({ profile, workouts: [] });
    expect(session.title).toBe("Chest and Bis — Vinny split");
    expect(session.prescriptions.map((p) => p.group)).toEqual([
      "Chest", "Chest", "Chest", "Tris", "Tris", "Tris", "Bis", "Bis", "Bis"
    ]);
    expect(session.prescriptions.every((p) => Boolean(p.scheme))).toBe(true);
    // Bis always opens with the warmed-up barbell curls.
    expect(session.prescriptions[6].exercise).toBe("Barbell Curls");
    expect(session.prescriptions[6].scheme).toBe("1 warm-up, then 3 sets of 10–12");
  });

  it("Day B runs Back(3) → Shoulders(3) → Traps(1) with the shoulder warm-up note", () => {
    const session = buildVinnySession({ profile, workouts: [], focusDay: "B" });
    expect(session.title).toBe("Back and Shoulders — Vinny split");
    expect(session.prescriptions.map((p) => p.group)).toEqual([
      "Back", "Back", "Back", "Shoulders", "Shoulders", "Shoulders", "Traps"
    ]);
    expect(session.prescriptions[3].note).toContain("upright rows or hanging clean and press");
    expect(session.prescriptions[6].exercise).toBe("Barbell or Dumbbell Shrugs");
  });

  it("accessory rep schemes come from the archive (10–12 / 8–10 / pulley 15–20)", () => {
    const session = buildVinnySession({ profile, workouts: [] });
    const accessories = session.prescriptions.slice(1);
    expect(accessories.every((p) => /3 sets of \d+–\d+|21's|back and forth/.test(p.scheme ?? ""))).toBe(
      true
    );
  });
});

describe("accessory rotation", () => {
  it("rotates accessories so consecutive same-day sessions differ", () => {
    const first = buildVinnySession({ profile, workouts: [], focusDay: "A" });
    // Two A-sessions in the log → rotation seed 2 (even, so no technique noise).
    const later = buildVinnySession({
      profile,
      workouts: [vinnyA("2026-07-01"), vinnyA("2026-07-04")],
      focusDay: "A"
    });
    const names = (s: typeof first) => s.prescriptions.map((p) => p.exercise).join("|");
    expect(names(later)).not.toBe(names(first));
    // Structure is preserved even as picks rotate.
    expect(later.prescriptions.map((p) => p.group)).toEqual(first.prescriptions.map((p) => p.group));
  });

  it("rotates the main lift too (incline ↔ flat bench)", () => {
    const first = buildVinnySession({ profile, workouts: [], focusDay: "A" });
    const second = buildVinnySession({ profile, workouts: [vinnyA("2026-07-01")], focusDay: "A" });
    expect(first.prescriptions[0].exercise).toBe("Incline Barbell Bench Press");
    expect(second.prescriptions[0].exercise).toBe("Flat Barbell Bench Press");
  });
});

describe("signature techniques", () => {
  it("adds push-ups after each chest set on the second A-session, with a coach tip", () => {
    const session = buildVinnySession({ profile, workouts: [vinnyA("2026-07-01")], focusDay: "A" });
    const chest = session.prescriptions.filter((p) => p.group === "Chest");
    expect(chest.every((p) => p.scheme?.includes("push-ups after each set"))).toBe(true);
    expect(session.tip).toMatch(/push-ups/i);
    // Only one technique at a time — no Bulgarian swings or 21's on this day.
    expect(session.prescriptions.some((p) => p.scheme?.includes("21's"))).toBe(false);
  });

  it("adds Bulgarian bag swings between back sets on the second B-session", () => {
    const session = buildVinnySession({ profile, workouts: [vinnyB("2026-07-01")], focusDay: "B" });
    const back = session.prescriptions.filter((p) => p.group === "Back");
    expect(back.every((p) => p.scheme?.includes("Bulgarian bag swings"))).toBe(true);
    expect(session.tip).toMatch(/bulgarian/i);
  });

  it("rotates to preacher-curl 21's on the fourth A-session", () => {
    const workouts = [
      vinnyA("2026-06-25"),
      vinnyA("2026-06-28"),
      vinnyA("2026-07-01")
    ];
    const session = buildVinnySession({ profile, workouts, focusDay: "A" });
    const last = session.prescriptions[session.prescriptions.length - 1];
    expect(last).toMatchObject({ exercise: "Preacher Curls", reps: 21, scheme: "3 sets of 21's" });
    // No duplicate preacher slot.
    expect(session.prescriptions.filter((p) => p.exercise === "Preacher Curls")).toHaveLength(1);
  });

  it("skips techniques on odd-free sessions and is fully deterministic", () => {
    const plain = buildVinnySession({ profile, workouts: [], focusDay: "A" });
    expect(plain.tip).toBeUndefined();
    const again = buildVinnySession({ profile, workouts: [], focusDay: "A" });
    expect(again).toEqual(plain);
    const withTech = buildVinnySession({ profile, workouts: [vinnyA("2026-07-01")], focusDay: "A" });
    expect(buildVinnySession({ profile, workouts: [vinnyA("2026-07-01")], focusDay: "A" })).toEqual(
      withTech
    );
  });
});

describe("plan wiring (buildProgressivePlan)", () => {
  it("uses the Vinny session for strength when coachStyle is vinny_split", () => {
    const plan = buildProgressivePlan(profile, [], DATE, NOW);
    const strength = plan.items.find((i) => i.bucket === "strength")!;
    expect(strength.title).toBe("Chest and Bis — Vinny split");
    expect(strength.kind).toBe("custom");
    expect(strength.prescriptions!.length).toBe(9);
    expect(strength.prescriptions!.every((p) => Boolean(p.group))).toBe(true);
    expect(strength.exercises!.length).toBe(9);
    expect(strength.exercises![0]).toContain("Chest · ");
  });

  it("keeps the simple-progressive session for other styles", () => {
    const plan = buildProgressivePlan(
      { ...profile, coachStyle: "simple_progressive" },
      [],
      DATE,
      NOW
    );
    const strength = plan.items.find((i) => i.bucket === "strength")!;
    expect(strength.title).toMatch(/simple progression/);
    expect(strength.prescriptions!.every((p) => p.group === undefined)).toBe(true);
  });

  it("leaves class-day martial arts untouched", () => {
    const plan = buildProgressivePlan(profile, [], DATE, NOW, { karateToday: true });
    const ma = plan.items.find((i) => i.bucket === "martial_arts")!;
    expect(ma.title).toBe("Karate class ✓ counts as today's session");
    expect(ma.description).toMatch(/10-min mobility cooldown/);
  });
});

describe("prescription schema round-trip", () => {
  it("parses group + scheme fields and keeps all 9 lines of a Vinny Day A (over the old 8 cap)", () => {
    const session = buildVinnySession({ profile, workouts: [], focusDay: "A" });
    const plan = parseDailyWorkoutPlan(
      {
        items: [
          {
            bucket: "strength",
            kind: "custom",
            title: session.title,
            prescriptions: session.prescriptions,
            progressionSummary: session.summary
          }
        ]
      },
      buildWorkoutCatalog(),
      DATE,
      NOW
    );
    const strength = plan.items[0];
    expect(session.prescriptions).toHaveLength(9);
    expect(strength.prescriptions).toHaveLength(9);
    expect(strength.prescriptions![0].group).toBe("Chest");
    expect(strength.prescriptions![0].scheme).toContain("4 sets increasing weight");
  });
});

describe("AI prompt pieces", () => {
  it("formats display lines with group and scheme", () => {
    expect(
      formatVinnyPrescriptionLine({
        exercise: "Incline Barbell Bench Press",
        sets: 4,
        reps: 3,
        weightLbs: 185,
        group: "Chest",
        scheme: "1 warm-up, then 4 sets increasing weight — triples: 130/150/165/185"
      })
    ).toBe(
      "Chest · Incline Barbell Bench Press — 1 warm-up, then 4 sets increasing weight — triples: 130/150/165/185"
    );
    expect(
      formatVinnyPrescriptionLine({
        exercise: "Dumbbell Rows",
        sets: 3,
        reps: 12,
        weightLbs: 60,
        group: "Back",
        scheme: "3 sets of 10–12"
      })
    ).toBe("Back · Dumbbell Rows — 3 sets of 10–12 @ 60 lb");
  });

  it("builds a ground-truth progression context for the AI", () => {
    const history = [
      strengthWorkout("2026-07-04", [{ exercise: "Incline Barbell Bench Press", reps: 3, weightLbs: 180 }])
    ];
    const context = buildVinnyProgressionContext(profile, history);
    expect(context).toContain("Day A — Chest and Bis");
    expect(context).toContain("triples: 130/150/165/185");
    expect(context).toContain("last session 2026-07-04: top set 180 lb × 3");
  });

  it("ships a style guide + few-shots quoted from the coach's archive", () => {
    expect(vinnyStyleGuide).toContain("4 sets increasing weight (Triples)");
    expect(vinnyStyleGuide).toContain("~70/80/90%");
    expect(vinnyFewShotExamples).toContain("Incline Barbell Bench Press — 1 warm up, then 4 sets increasing weight (Triples)");
    expect(vinnyFewShotExamples).toContain("Hex Bar Deadlifts from the floor");
    expect(vinnyFewShotExamples).toContain("Preacher Curls — 3 sets of 21's");
  });
});
