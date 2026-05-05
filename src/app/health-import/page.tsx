import type { Metadata } from "next";

import { HealthImport } from "@/components/HealthImport";

export const metadata: Metadata = {
  title: "Health Import"
};

export default function HealthImportPage() {
  return <HealthImport />;
}
