"use client";

import { useEffect, useRef, useState } from "react";

import { celebrateEventName, type CelebrationDetail } from "@/client/celebrate";
import { CharacterSprite } from "@/components/CharacterSprite";

const DISPLAY_MS = 2200;

export function CelebrationOverlay() {
  const [celebration, setCelebration] = useState<CelebrationDetail | null>(null);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    function onCelebrate(event: Event) {
      const detail = (event as CustomEvent<CelebrationDetail>).detail;
      if (!detail) return;
      setCelebration(detail);
      if (timerRef.current) window.clearTimeout(timerRef.current);
      timerRef.current = window.setTimeout(() => setCelebration(null), DISPLAY_MS);
    }
    window.addEventListener(celebrateEventName, onCelebrate);
    return () => {
      window.removeEventListener(celebrateEventName, onCelebrate);
      if (timerRef.current) window.clearTimeout(timerRef.current);
    };
  }, []);

  if (!celebration) return null;

  const pose = celebration.pose ?? "victory";

  return (
    <div className="celebration-overlay" role="status" aria-live="polite">
      <div className={`celebration-card celebration-card-${celebration.kind}`}>
        {celebration.kind === "boss" ? (
          <p className="celebration-crown" aria-hidden="true">
            ✦ 👑 ✦
          </p>
        ) : null}
        <div className="celebration-sprite" aria-hidden="true">
          <CharacterSprite pose={pose} className="celebration-sprite-img" />
        </div>
        <p className="celebration-title">{celebration.title}</p>
        {celebration.subtitle ? (
          <p className="celebration-subtitle">{celebration.subtitle}</p>
        ) : null}
        {typeof celebration.xp === "number" && celebration.xp > 0 ? (
          <p className="celebration-xp" aria-hidden="true">
            +{celebration.xp} XP
          </p>
        ) : null}
      </div>
    </div>
  );
}
