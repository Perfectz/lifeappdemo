import type { Metadata } from "next";

import { AICoachPanel } from "@/components/AICoachPanel";

export const metadata: Metadata = {
  title: "LifeQuest Agent"
};

export default function CoachPage() {
  return <AICoachPanel />;
}
