import type { CharacterSpritePose } from "@/config/sprites";
import type { Task } from "@/domain";
import { taskXp } from "@/domain/tasks";

export const celebrateEventName = "lifequest:celebrate";

export type CelebrationKind = "quest" | "levelup" | "streak" | "pr" | "boss";

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

/**
 * The celebration payload for clearing a quest, scaled by difficulty:
 * epic quests are boss fights (their own kind, bigger card, purple-gold
 * burst), hard quests call out the double XP, everything else keeps the
 * classic moment. Pure — the single source every completion surface uses.
 */
export function questCompletionCelebration(
  task: Pick<Task, "title" | "difficulty">
): CelebrationDetail {
  const xp = taskXp(task);

  if (task.difficulty === "epic") {
    return {
      kind: "boss",
      title: `BOSS QUEST CLEARED — +${xp} XP`,
      subtitle: task.title,
      pose: "victory"
    };
  }

  if (task.difficulty === "hard") {
    return {
      kind: "quest",
      title: "QUEST COMPLETE!",
      subtitle: `${task.title} — +${xp} XP`,
      pose: "questComplete"
    };
  }

  return {
    kind: "quest",
    title: "QUEST COMPLETE!",
    subtitle: task.title,
    pose: "questComplete"
  };
}
