import type { Metadata } from "next";

import { MorningStandup } from "@/components/MorningStandup";

export const metadata: Metadata = {
  title: "Morning Standup"
};

export default function MorningStandupPage() {
  return <MorningStandup />;
}
