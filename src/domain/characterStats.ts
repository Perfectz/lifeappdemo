import type { IsoDate, MetricEntry, Workout } from "@/domain/types";
import type { HealthGoals } from "@/domain/healthGoals";

/**
 * RPG character sheet derived from real logged data over a recent window.
 * Five anime-style stats (0–99). All computed deterministically — no AI.
 *
 * STR        strength training volume
 * END        cardio / endurance volume
 * TECHNIQUE  martial-arts practice
 * VITALITY   vitals logged and in healthy range
 * DISCIPLINE day-to-day consistency (anything logged)
 */

export type CharacterStatKey = "str" | "end" | "technique" | "vitality" | "discipline";

export type CharacterStat = {
  key: CharacterStatKey;
  label: string;
  value: number; // 0–99
};

export type CharacterStats = {
  stats: CharacterStat[];
  overall: number;
};

const WINDOW_DAYS = 30;
const STAT_LABEL: Record<CharacterStatKey, string> = {
  str: "STR",
  end: "END",
  technique: "TECH",
  vitality: "VIT",
  discipline: "DISC"
};

function clamp99(value: number): number {
  return Math.max(0, Math.min(99, Math.round(value)));
}

/** Scale a count toward a "maxed" target into a 0–99 stat. */
function scaleCount(count: number, target: number): number {
  if (target <= 0) return 0;
  return clamp99((count / target) * 99);
}

function withinWindow(dateIso: string, startIso: IsoDate): boolean {
  return dateIso >= startIso;
}

function shiftIso(iso: IsoDate, deltaDays: number): IsoDate {
  const [y, m, d] = iso.split("-").map(Number);
  const date = new Date(y, (m ?? 1) - 1, d ?? 1);
  date.setDate(date.getDate() + deltaDays);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
    date.getDate()
  ).padStart(2, "0")}`;
}

export function computeCharacterStats(input: {
  today: IsoDate;
  metrics: MetricEntry[];
  workouts: Workout[];
  goals: HealthGoals;
  windowDays?: number;
}): CharacterStats {
  const windowDays = input.windowDays ?? WINDOW_DAYS;
  const start = shiftIso(input.today, -(windowDays - 1));

  const recentWorkouts = input.workouts.filter((w) => withinWindow(w.date, start));
  const strengthCount = recentWorkouts.filter((w) => w.type === "strength").length;
  const cardioCount = recentWorkouts.filter((w) => w.type === "cardio").length;
  const martialCount = recentWorkouts.filter((w) => w.type === "martial_arts").length;

  const recentMetrics = input.metrics.filter((m) => withinWindow(m.date, start));

  // VITALITY — fraction of BP/glucose readings that sit in a healthy range.
  let inRange = 0;
  let readings = 0;
  for (const entry of recentMetrics) {
    if (entry.bloodPressureSystolic !== undefined && entry.bloodPressureDiastolic !== undefined) {
      readings += 1;
      if (
        entry.bloodPressureSystolic <= input.goals.bpSystolicTarget &&
        entry.bloodPressureDiastolic <= input.goals.bpDiastolicTarget
      ) {
        inRange += 1;
      }
    }
    if (entry.bloodGlucoseMgDl !== undefined) {
      readings += 1;
      const limit = entry.glucoseContext === "fasting" ? input.goals.fastingGlucoseTarget : 160;
      if (entry.bloodGlucoseMgDl <= limit) {
        inRange += 1;
      }
    }
  }
  const vitality = readings > 0 ? clamp99((inRange / readings) * 99) : 0;

  // DISCIPLINE — share of the window's days with anything logged.
  const activeDays = new Set<string>();
  recentMetrics.forEach((m) => activeDays.add(m.date));
  recentWorkouts.forEach((w) => activeDays.add(w.date));
  const discipline = clamp99((activeDays.size / windowDays) * 99);

  // Targets reflect a strong month: ~4 strength, ~5 cardio, ~3 martial / week.
  const stats: CharacterStat[] = [
    { key: "str", label: STAT_LABEL.str, value: scaleCount(strengthCount, 16) },
    { key: "end", label: STAT_LABEL.end, value: scaleCount(cardioCount, 20) },
    { key: "technique", label: STAT_LABEL.technique, value: scaleCount(martialCount, 12) },
    { key: "vitality", label: STAT_LABEL.vitality, value: vitality },
    { key: "discipline", label: STAT_LABEL.discipline, value: discipline }
  ];

  const overall = clamp99(stats.reduce((sum, stat) => sum + stat.value, 0) / stats.length);

  return { stats, overall };
}
