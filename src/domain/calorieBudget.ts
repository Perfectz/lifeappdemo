/**
 * Suggests a daily calorie budget + macro split from body stats, à la LoseIt /
 * MyFitnessPal. Uses the Mifflin-St Jeor BMR equation × an activity multiplier
 * (TDEE), minus a deficit for weight loss. Purely informational — paired with a
 * "not medical/dietetic advice" note in the UI.
 */

export const activityLevels = ["sedentary", "light", "moderate", "active"] as const;
export type ActivityLevel = (typeof activityLevels)[number];

export const activityLevelLabel: Record<ActivityLevel, string> = {
  sedentary: "Sedentary (little exercise)",
  light: "Light (1–3 days/week)",
  moderate: "Moderate (3–5 days/week)",
  active: "Active (6–7 days/week)"
};

const ACTIVITY_MULTIPLIER: Record<ActivityLevel, number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  active: 1.725
};

export type BiologicalSex = "male" | "female";

export type CalorieBudgetInput = {
  sex: BiologicalSex;
  age: number;
  heightInches: number;
  weightLbs: number;
  activityLevel: ActivityLevel;
  /** Target weight used to anchor the protein goal; defaults to current weight. */
  targetWeightLbs?: number;
  goal: "lose" | "maintain";
};

export type CalorieBudget = {
  bmr: number;
  tdee: number;
  recommendedCalories: number;
  proteinTargetG: number;
  carbsTargetG: number;
  fatTargetG: number;
};

const MIN_CALORIES: Record<BiologicalSex, number> = { male: 1500, female: 1200 };

function round(value: number): number {
  return Math.round(value);
}

export function computeCalorieBudget(input: CalorieBudgetInput): CalorieBudget {
  const kg = input.weightLbs / 2.20462;
  const cm = input.heightInches * 2.54;
  const base = 10 * kg + 6.25 * cm - 5 * input.age;
  const bmr = round(base + (input.sex === "male" ? 5 : -161));
  const tdee = round(bmr * ACTIVITY_MULTIPLIER[input.activityLevel]);

  const deficit = input.goal === "lose" ? 500 : 0;
  const recommendedCalories = Math.max(MIN_CALORIES[input.sex], round(tdee - deficit));

  // Protein anchored to target body weight (~0.8 g/lb); fat ~25% of calories;
  // carbs fill the remainder (floored at 0).
  const anchorWeight = input.targetWeightLbs ?? input.weightLbs;
  const proteinTargetG = round(anchorWeight * 0.8);
  const fatTargetG = round((recommendedCalories * 0.25) / 9);
  const carbsTargetG = Math.max(
    0,
    round((recommendedCalories - proteinTargetG * 4 - fatTargetG * 9) / 4)
  );

  return { bmr, tdee, recommendedCalories, proteinTargetG, carbsTargetG, fatTargetG };
}
