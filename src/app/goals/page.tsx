import type { Metadata } from "next";

import { GoalsWorkspace } from "@/components/GoalsWorkspace";

export const metadata: Metadata = { title: "Goals" };

export default function GoalsPage() {
  return <GoalsWorkspace />;
}
