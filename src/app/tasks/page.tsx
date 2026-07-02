import type { Metadata } from "next";

import { QuestLog } from "@/components/QuestLog";

export const metadata: Metadata = {
  title: "Quest Log"
};

export default function TasksPage() {
  return <QuestLog />;
}
