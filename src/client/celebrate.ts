import type { CharacterSpritePose } from "@/config/sprites";

export const celebrateEventName = "lifequest:celebrate";

export type CelebrationKind = "quest" | "levelup" | "streak";

export type CelebrationDetail = {
  kind: CelebrationKind;
  title: string;
  subtitle?: string;
  pose?: CharacterSpritePose;
  /** Optional XP amount to float up. */
  xp?: number;
};

/**
 * Fire a transient celebration. A single overlay listens app-wide and
 * renders the moment — this is the dopamine payoff the JRPG framing
 * promised but didn't previously deliver.
 */
export function celebrate(detail: CelebrationDetail): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent<CelebrationDetail>(celebrateEventName, { detail }));
}
