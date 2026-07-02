import type { Metadata } from "next";

import { MedicationQuickLog } from "@/components/MedicationQuickLog";
import { SupplementLog } from "@/components/SupplementLog";
import { Vitals } from "@/components/Vitals";

export const metadata: Metadata = {
  title: "Vitals"
};

export default function VitalsPage() {
  return (
    <div className="vitals-page">
      <MedicationQuickLog />
      <Vitals />
      <SupplementLog />
    </div>
  );
}
