import type { Metadata } from "next";

import { MetricsCheckIn } from "@/components/MetricsCheckIn";

export const metadata: Metadata = {
  title: "Metrics"
};

export default function MetricsPage() {
  return <MetricsCheckIn />;
}
