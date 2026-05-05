import Image from "next/image";

import { withBasePath } from "@/config/site";

export type AdvisorMood =
  | "talk"
  | "supportive"
  | "victory"
  | "thoughtful"
  | "concerned"
  | "determined"
  | "tired";

type AiAdvisorPopupProps = {
  message: string;
  mood?: AdvisorMood;
};

const moodAssets: Exclude<AdvisorMood, "talk">[] = [
  "supportive",
  "victory",
  "thoughtful",
  "concerned",
  "determined",
  "tired"
];

const portraitAssets: Record<Exclude<AdvisorMood, "talk">, string> = {
  supportive: "/assets/sprites/ai-advisor-emotions/01-supportive-smile.png",
  victory: "/assets/sprites/ai-advisor-emotions/02-victory-cheer.png",
  thoughtful: "/assets/sprites/ai-advisor-emotions/03-thoughtful-planning.png",
  concerned: "/assets/sprites/ai-advisor-emotions/04-concerned-alert.png",
  determined: "/assets/sprites/ai-advisor-emotions/05-determined-focus.png",
  tired: "/assets/sprites/ai-advisor-emotions/06-tired-reassurance.png"
};

export function AiAdvisorPopup({ message, mood = "talk" }: AiAdvisorPopupProps) {
  const hasPortrait = moodAssets.includes(mood as Exclude<AdvisorMood, "talk">);

  return (
    <section className={`advisor-popup advisor-popup-${mood}`} aria-label="AI insight">
      <div className="advisor-character" aria-hidden="true">
        {hasPortrait ? (
          <Image
            alt=""
            className="advisor-portrait"
            height={512}
            priority
            src={withBasePath(portraitAssets[mood as Exclude<AdvisorMood, "talk">])}
            unoptimized
            width={512}
          />
        ) : (
          <div
            className="advisor-sprite"
            style={{
              backgroundImage: `url("${withBasePath("/assets/sprites/ai-advisor-talk-sheet.png")}")`
            }}
          />
        )}
      </div>
      <div className="advisor-bubble" role="status">
        <p className="eyebrow">AI Insight</p>
        <p>{message}</p>
      </div>
    </section>
  );
}
