import type { Metadata } from "next";

import { DailyReportExport } from "@/components/DailyReportExport";
import { WeekInReview } from "@/components/WeekInReview";

export const metadata: Metadata = {
  title: "Reports"
};

export default function ReportsPage() {
  return (
    <>
      <WeekInReview />
      <DailyReportExport />
    </>
  );
}
