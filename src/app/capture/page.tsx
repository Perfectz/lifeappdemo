import type { Metadata } from "next";

import { CaptureWorkspace } from "@/components/CaptureWorkspace";

export const metadata: Metadata = {
  title: "Capture"
};

export default function CapturePage() {
  return <CaptureWorkspace />;
}
