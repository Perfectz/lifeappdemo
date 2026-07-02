import type { Metadata } from "next";

import { AICoachPanel } from "@/components/AICoachPanel";

export const metadata: Metadata = {
  title: "AI Coach"
};

export default function CoachPage() {
  return <AICoachPanel />;
}
