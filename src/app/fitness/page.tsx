import type { Metadata } from "next";

import { DailyFitness } from "@/components/DailyFitness";

export const metadata: Metadata = {
  title: "Fitness"
};

export default function FitnessPage() {
  return <DailyFitness />;
}
