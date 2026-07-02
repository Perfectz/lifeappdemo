import type { Metadata } from "next";

import { ProgressPhotos } from "@/components/ProgressPhotos";

export const metadata: Metadata = {
  title: "Progress"
};

export default function ProgressPage() {
  return (
    <section className="standup-page" aria-labelledby="progress-title">
      <header className="standup-hero">
        <div>
          <p className="eyebrow">Transformation</p>
          <h1 id="progress-title">Progress Photos</h1>
          <p>Three angles a day. Watch yourself become Patrick 2.0.</p>
        </div>
      </header>
      <ProgressPhotos />
    </section>
  );
}
