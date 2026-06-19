/**
 * The transformation level system. Level 1 = day-one self; the max level = the
 * goal ("Patrick 2.0", the user's uploaded final-form image). Level is driven
 * by journey progress (0% → 100%) from the transformation domain, which blends
 * weight-goal progress with recent consistency. XP within a level is the
 * fractional position inside the current level's band.
 */

export const MAX_LEVEL = 50;

export type LevelInfo = {
  level: number;
  maxLevel: number;
  /** 0–100 overall progress from day-one self to the goal. */
  journeyPercent: number;
  /** 0–100 progress through the current level (the XP bar). */
  percentIntoLevel: number;
  isMaxLevel: boolean;
  title: string;
};

function clamp(value: number): number {
  return Math.max(0, Math.min(100, value));
}

function levelTitle(level: number, maxLevel: number): string {
  if (level >= maxLevel) return "Patrick 2.0 — final form";
  const ratio = level / maxLevel;
  if (level <= 1) return "Day One";
  if (ratio < 0.25) return "Awakening";
  if (ratio < 0.45) return "Training Arc";
  if (ratio < 0.65) return "Breakthrough";
  if (ratio < 0.85) return "Ascending";
  return "Final form incoming";
}

/** True when the user just crossed into a higher level (fire the fanfare once). */
export function shouldCelebrateLevelUp(
  previousLevel: number | null,
  currentLevel: number
): boolean {
  return previousLevel !== null && currentLevel > previousLevel;
}

export function levelFromJourney(journeyPercent: number): LevelInfo {
  const jp = clamp(journeyPercent);
  const span = MAX_LEVEL - 1;
  const level = Math.min(MAX_LEVEL, 1 + Math.floor((jp / 100) * span));
  const isMaxLevel = level >= MAX_LEVEL;

  const band = 100 / span; // journey-% covered by one level
  const levelStart = (level - 1) * band;
  const percentIntoLevel = isMaxLevel
    ? 100
    : Math.max(0, Math.min(100, Math.round(((jp - levelStart) / band) * 100)));

  return {
    level,
    maxLevel: MAX_LEVEL,
    journeyPercent: jp,
    percentIntoLevel,
    isMaxLevel,
    title: levelTitle(level, MAX_LEVEL)
  };
}
