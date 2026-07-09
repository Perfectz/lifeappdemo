import type { Metadata } from "next";

import { SupplementLog } from "@/components/SupplementLog";
import { Vitals } from "@/components/Vitals";

export const metadata: Metadata = {
  title: "Vitals"
};

export default function VitalsPage() {
  return (
    <div className="vitals-page">
      <header className="standup-hero">
        <div>
          <p className="eyebrow">Health</p>
          <h1 id="vitals-title">Vitals</h1>
          <p>Log glucose, blood pressure, weight, meds &amp; supplements.</p>
        </div>
      </header>
      <Vitals />
      <SupplementLog />
    </div>
  );
}
