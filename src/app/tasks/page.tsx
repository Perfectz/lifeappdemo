import type { Metadata } from "next";

import { CoachQuestSuggestions } from "@/components/CoachQuestSuggestions";
import { QuestLog } from "@/components/QuestLog";

export const metadata: Metadata = {
  title: "Quest Log"
};

export default function TasksPage() {
  return (
    <>
      <CoachQuestSuggestions />
      <QuestLog />
    </>
  );
}
