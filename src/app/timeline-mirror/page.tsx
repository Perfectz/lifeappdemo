import type { Metadata } from "next";

import { TimelineMirror } from "@/components/TimelineMirror";

export const metadata: Metadata = {
  title: "Timeline Mirror"
};

export default function TimelineMirrorPage() {
  return (
    <section className="standup-page" aria-labelledby="timeline-mirror-title">
      <header className="standup-hero">
        <div>
          <p className="eyebrow">Mirror Crystal</p>
          <h1 id="timeline-mirror-title">Timeline Mirror</h1>
          <p>
            Upload a checkpoint photo and the mirror reads which timeline you&apos;re feeding —
            your Ideal Self or your Shadow Self.
          </p>
        </div>
      </header>
      <TimelineMirror />
    </section>
  );
}
