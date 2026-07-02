import type { Metadata } from "next";

import { DailyReportExport } from "@/components/DailyReportExport";

export const metadata: Metadata = {
  title: "Reports"
};

export default function ReportsPage() {
  return <DailyReportExport />;
}
