import type { Equipment } from "@/domain";

/**
 * The user's fixed daily training structure: one strength session (one of five
 * split days), one cardio session, and one martial-arts session. These options
 * mirror their June training plan and available activities.
 */

export type StrengthExercise = { name: string; scheme: string };

export type StrengthWorkout = {
  id: string;
  day: number;
  name: string;
  exercises: StrengthExercise[];
};

export const strengthWorkouts: StrengthWorkout[] = [
  {
    id: "day-1",
    day: 1,
    name: "Chest & Biceps",
    exercises: [
      { name: "Flat Chest Press", scheme: "4 × 8–10" },
      { name: "Incline Chest Press", scheme: "3 × 10–12" },
      { name: "Chest Fly", scheme: "3 × 12–15" },
      { name: "Biceps Curl", scheme: "3 × 10–12" },
      { name: "Hammer Curl", scheme: "3 × 10–12" }
    ]
  },
  {
    id: "day-2",
    day: 2,
    name: "Back & Shoulders",
    exercises: [
      { name: "Hip Hinge / Deadlift", scheme: "4 × 6–8" },
      { name: "Vertical Pull (Lats)", scheme: "4 × 10–12" },
      { name: "Horizontal Row", scheme: "3 × 10–12" },
      { name: "Shoulder Press", scheme: "3 × 8–10" },
      { name: "Lateral Raise", scheme: "3 × 12–15" }
    ]
  },
  {
    id: "day-3",
    day: 3,
    name: "Legs & Core",
    exercises: [
      { name: "Squat", scheme: "4 × 8–10" },
      { name: "Hamstring / Hinge", scheme: "3 × 10–12" },
      { name: "Lunge / Split Squat", scheme: "3 × 10 / leg" },
      { name: "Calf Raise", scheme: "4 × 15" },
      { name: "Core", scheme: "3 × 15–20" }
    ]
  },
  {
    id: "day-4",
    day: 4,
    name: "Chest & Arms",
    exercises: [
      { name: "Chest Press", scheme: "4 × 8–10" },
      { name: "Dip / Push Movement", scheme: "3 × 10–15" },
      { name: "Overhead Triceps Extension", scheme: "3 × 10–12" },
      { name: "Triceps (Close)", scheme: "3 × 10–12" },
      { name: "Biceps (21s or straight)", scheme: "3 × 10–12" }
    ]
  },
  {
    id: "day-5",
    day: 5,
    name: "Shoulders & Back",
    exercises: [
      { name: "Overhead Press", scheme: "4 × 8–10" },
      { name: "Upright Row", scheme: "3 × 10–12" },
      { name: "Shrugs (Traps)", scheme: "3 × 12–15" },
      { name: "Rear Delts", scheme: "3 × 12–15" },
      { name: "Lat Pull / Row", scheme: "3 × 10–12" }
    ]
  }
];

export type StrengthVariant = "Free Weight" | "Machine" | "Kettlebell";
export const strengthVariants: StrengthVariant[] = ["Free Weight", "Machine", "Kettlebell"];

/** Map a chosen variant to the Equipment tags stored on the workout record. */
export function equipmentForVariant(variant: StrengthVariant): Equipment[] {
  if (variant === "Kettlebell") return ["kettlebell"];
  if (variant === "Free Weight") return ["adjustable_dumbbells", "adjustable_bench"];
  return []; // Machine — no home-equipment tag
}

export type CardioOption = { id: string; label: string };
export const cardioOptions: CardioOption[] = [
  { id: "walk", label: "Walk" },
  { id: "run", label: "Run" },
  { id: "jog", label: "Jog" },
  { id: "ddr", label: "DDR" },
  { id: "bike-vest", label: "Exercise bike + weight vest" }
];

export type MartialArtsOption = { id: string; label: string };
export const martialArtsOptions: MartialArtsOption[] = [
  { id: "bas-beginner", label: "Bas Rutten Boxing — Beginner (audio)" },
  { id: "bas-advanced", label: "Bas Rutten Boxing — Advanced (audio)" },
  { id: "shidokan-kickboxing", label: "Shidokan Atlanta — Kickboxing class" },
  { id: "shidokan-karate", label: "Shidokan Atlanta — Karate class" }
];
