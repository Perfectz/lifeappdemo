import type { Metadata } from "next";

import { TrendsView } from "@/components/TrendsView";

export const metadata: Metadata = {
  title: "Trends"
};

export default function TrendsPage() {
  return <TrendsView />;
}
