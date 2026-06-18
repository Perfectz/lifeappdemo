import type { IsoDate, MetricEntry, Workout } from "@/domain/types";
import { getDailyFitnessStatus } from "@/domain/dailyFitness";
import type { HealthGoals } from "@/domain/healthGoals";
import { latestBloodPressure, latestGlucose, latestWeight } from "@/domain/vitals";

/**
 * The daily "alignment" score: how much today's logged actions move the user
 * toward their North Star. Deterministic and computed only from data already
 * logged — it never calls the AI. Max score is 100.
 */

export type AlignmentContribution = {
  key: string;
  label: string;
  points: number;
  earned: number;
};

export type AlignmentLevel = "not_started" | "getting_started" | "on_track" | "strongly_aligned";

export type DailyAlignment = {
  score: number;
  max: number;
  percent: number;
  level: AlignmentLevel;
  label: string;
  contributions: AlignmentContribution[];
};

const ALIGNMENT_LABEL: Record<AlignmentLevel, string> = {
  not_started: "Not started yet",
  getting_started: "Getting started",
  on_track: "On track",
  strongly_aligned: "Strongly aligned"
};

function levelFor(percent: number): AlignmentLevel {
  if (percent >= 80) return "strongly_aligned";
  if (percent >= 50) return "on_track";
  if (percent >= 1) return "getting_started";
  return "not_started";
}

export function computeDailyAlignment(input: {
  today: IsoDate;
  metrics: MetricEntry[];
  workouts: Workout[];
  goals: HealthGoals;
}): DailyAlignment {
  const { today, metrics, workouts, goals } = input;
  const todayMetrics = metrics.filter((entry) => entry.date === today);
  const bp = latestBloodPressure(todayMetrics);
  const glucose = latestGlucose(todayMetrics);
  const weight = latestWeight(todayMetrics);
  const fitness = getDailyFitnessStatus(workouts, today);

  const bpInRange =
    bp !== undefined && bp.systolic <= goals.bpSystolicTarget && bp.diastolic <= goals.bpDiastolicTarget;
  const glucoseInRange =
    glucose !== undefined &&
    glucose.mgDl <= (glucose.context === "fasting" ? goals.fastingGlucoseTarget : 160);

  const contributions: AlignmentContribution[] = [
    { key: "glucose_logged", label: "Logged glucose", points: 10, earned: glucose ? 10 : 0 },
    { key: "bp_logged", label: "Logged blood pressure", points: 10, earned: bp ? 10 : 0 },
    { key: "weight_logged", label: "Logged weight", points: 10, earned: weight ? 10 : 0 },
    { key: "bp_in_range", label: "Blood pressure in range", points: 10, earned: bpInRange ? 10 : 0 },
    { key: "glucose_in_range", label: "Glucose in range", points: 10, earned: glucoseInRange ? 10 : 0 },
    {
      key: "strength",
      label: "Strength session",
      points: 15,
      earned: fitness.byType.strength ? 15 : 0
    },
    { key: "cardio", label: "Cardio session", points: 15, earned: fitness.byType.cardio ? 15 : 0 },
    {
      key: "martial_arts",
      label: "Martial arts session",
      points: 20,
      earned: fitness.byType.martial_arts ? 20 : 0
    }
  ];

  const max = contributions.reduce((sum, item) => sum + item.points, 0);
  const score = contributions.reduce((sum, item) => sum + item.earned, 0);
  const percent = max > 0 ? Math.round((score / max) * 100) : 0;
  const level = levelFor(percent);

  return {
    score,
    max,
    percent,
    level,
    label: ALIGNMENT_LABEL[level],
    contributions
  };
}
