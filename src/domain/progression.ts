/**
 * Streak milestones that earn recognition. Hitting one fires a
 * celebration; the highest reached is shown on the hero card.
 */
export const streakMilestones = [3, 7, 14, 30, 60, 100] as const;

export function getStreakMilestone(streak: number): number | null {
  let reached: number | null = null;
  for (const milestone of streakMilestones) {
    if (streak >= milestone) {
      reached = milestone;
    }
  }
  return reached;
}

export function isStreakMilestone(streak: number): boolean {
  return (streakMilestones as readonly number[]).includes(streak);
}

/** A short flavor rank shown next to the hero level. */
export function getHeroRank(level: number): string {
  if (level >= 25) return "Legend";
  if (level >= 15) return "Champion";
  if (level >= 10) return "Veteran";
  if (level >= 5) return "Adventurer";
  if (level >= 2) return "Apprentice";
  return "Novice";
}
