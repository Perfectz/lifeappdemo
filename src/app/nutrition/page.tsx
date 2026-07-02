import type { Metadata } from "next";

import { NutritionDiary } from "@/components/NutritionDiary";

export const metadata: Metadata = {
  title: "Nutrition"
};

export default function NutritionPage() {
  return (
    <section className="standup-page" aria-labelledby="nutrition-title">
      <header className="standup-hero">
        <div>
          <p className="eyebrow">Nutrition</p>
          <h1 id="nutrition-title">Food Diary</h1>
          <p>Log meals, calories, and macros against your daily budget.</p>
        </div>
      </header>
      <NutritionDiary />
    </section>
  );
}
