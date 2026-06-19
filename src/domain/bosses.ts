import type { IsoDate, MetricEntry } from "@/domain/types";
import type { HealthGoals } from "@/domain/healthGoals";
import { weightGoalProgressPercent } from "@/domain/healthGoals";
import { latestBloodPressure, latestGlucose, latestWeight } from "@/domain/vitals";

/**
 * "Boss battles" — health targets framed as bosses whose HP drains as the
 * user's real metrics improve, and who are defeated when the goal is met.
 * Deterministic; purely a motivational lens over the same data. Not medical
 * advice.
 */

export type Boss = {
  id: string;
  name: string;
  flavor: string;
  /** 0–100; 0 = defeated. */
  hp: number;
  defeated: boolean;
  /** Whether there's data to fight this boss yet. */
  engaged: boolean;
  detail: string;
};

function clampHp(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function recentAvgSleep(metrics: MetricEntry[], today: IsoDate, days = 7): number | undefined {
  const [y, m, d] = today.split("-").map(Number);
  const start = new Date(y, (m ?? 1) - 1, d ?? 1);
  start.setDate(start.getDate() - (days - 1));
  const startIso = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, "0")}-${String(
    start.getDate()
  ).padStart(2, "0")}`;
  const values = metrics
    .filter((entry) => entry.sleepHours !== undefined && entry.date >= startIso)
    .map((entry) => entry.sleepHours as number);
  if (values.length === 0) return undefined;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

export function computeBosses(input: {
  today: IsoDate;
  metrics: MetricEntry[];
  goals: HealthGoals;
}): Boss[] {
  const { today, metrics, goals } = input;
  const bp = latestBloodPressure(metrics);
  const glucose = latestGlucose(metrics);
  const weight = latestWeight(metrics);
  const bosses: Boss[] = [];

  // Hypertension — HP from how far the latest BP sits above target.
  {
    const engaged = bp !== undefined;
    const sysOver = bp ? Math.max(0, bp.systolic - goals.bpSystolicTarget) : 0;
    const diaOver = bp ? Math.max(0, bp.diastolic - goals.bpDiastolicTarget) : 0;
    const hp = engaged ? clampHp((Math.max(sysOver, diaOver) / 40) * 100) : 100;
    bosses.push({
      id: "hypertension",
      name: "Hypertension",
      flavor: "The silent pressure boss.",
      hp,
      defeated: engaged && hp === 0,
      engaged,
      detail: bp ? `Latest ${bp.systolic}/${bp.diastolic} · target ≤${goals.bpSystolicTarget}/${goals.bpDiastolicTarget}` : "Log a blood-pressure reading to engage."
    });
  }

  // The Plateau — HP from weight remaining toward goal.
  {
    const progress = weightGoalProgressPercent(goals, weight?.weightLbs);
    const engaged = progress !== undefined;
    const hp = engaged ? clampHp(100 - progress) : 100;
    bosses.push({
      id: "plateau",
      name: "The Plateau",
      flavor: "Guardian of the scale.",
      hp,
      defeated: engaged && hp === 0,
      engaged,
      detail:
        progress !== undefined && weight
          ? `${weight.weightLbs} lb → ${goals.weightTargetLbs} lb (${progress}%)`
          : "Set a weight goal and log your weight to engage."
    });
  }

  // Sugar Spike — HP from latest glucose above target.
  {
    const engaged = glucose !== undefined;
    const limit = glucose?.context === "fasting" ? goals.fastingGlucoseTarget : 140;
    const over = glucose ? Math.max(0, glucose.mgDl - limit) : 0;
    const hp = engaged ? clampHp((over / 80) * 100) : 100;
    bosses.push({
      id: "sugar-spike",
      name: "Sugar Spike",
      flavor: "Feeds on the glucose curve.",
      hp,
      defeated: engaged && hp === 0,
      engaged,
      detail: glucose ? `Latest ${glucose.mgDl} mg/dL · target ≤${limit}` : "Log a glucose reading to engage."
    });
  }

  // Sleep Debt — HP from how far recent average sleep falls short of target.
  {
    const avg = recentAvgSleep(metrics, today);
    const engaged = avg !== undefined;
    const target = goals.sleepHoursTarget;
    const shortfall = avg !== undefined ? Math.max(0, target - avg) : 0;
    const hp = engaged ? clampHp((shortfall / target) * 100) : 100;
    bosses.push({
      id: "sleep-debt",
      name: "Sleep Debt",
      flavor: "Grows in the dark hours.",
      hp,
      defeated: engaged && hp === 0,
      engaged,
      detail:
        avg !== undefined
          ? `7-day avg ${Math.round(avg * 10) / 10}h · target ${target}h`
          : "Log or import sleep to engage."
    });
  }

  return bosses;
}
