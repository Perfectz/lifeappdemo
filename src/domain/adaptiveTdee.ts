/**
 * Adaptive TDEE — learn the user's *measured* energy expenditure from how their
 * weight trend responded to their logged intake, instead of trusting a static
 * Mifflin–St Jeor estimate. Pure + deterministic; all I/O lives in the client.
 *
 * Energy balance: over a window, stored energy ≈ Δfat-mass kcal. With
 *   stored = intake − expenditure  and  ΔweightLb × 3500 ≈ stored,
 * we back-calculate:
 *   expenditure ≈ avgDailyIntake − (Δtrend-weightLb × 3500 / windowDays).
 *
 * Robustness:
 *  - weight is smoothed via least-squares regression (water-weight resistant);
 *  - the learned estimate is confidence-weighted against Mifflin and clamped to
 *    ±25% so a bad/sparse window can never produce an absurd number.
 */

const KCAL_PER_LB = 3500;

/** Hard safety bounds shared by every path. */
export const LEARNED_CLAMP_FRACTION = 0.25; // learned TDEE stays within ±25% of Mifflin
export const MAX_DEFICIT_FRACTION = 0.25; // daily deficit/surplus ≤ 25% of TDEE

/** Minimum data before the learned estimate earns any weight. */
export const MIN_LOGGED_DAYS = 7;
export const MIN_WEIGH_IN_SPAN_DAYS = 10;

export type WeightSample = { date: string; weightLbs: number };

export type WeightTrend = {
  /** Smoothed current trend weight (regression value at the latest date). */
  trendWeightLb: number;
  /** Slope of the trend in lb per week (negative = losing). */
  slopeLbPerWeek: number;
  /** Net trend change across the window (lb). */
  deltaLb: number;
  /** Number of distinct weigh-in days used. */
  weighInDays: number;
  /** Days spanned from first to last weigh-in. */
  spanDays: number;
};

export type AdaptiveTdeeInput = {
  /** Mifflin–St Jeor TDEE (the textbook baseline). */
  mifflinTdee: number;
  /** Daily weigh-ins within the window (any order; deduped by date, latest wins). */
  weightSamples: WeightSample[];
  /** Average logged daily calories over the window (only days with intake). */
  avgDailyIntake: number;
  /** Number of days within the window that had logged intake. */
  loggedDays: number;
  /** Window length in days the samples were drawn from. */
  windowDays: number;
};

export type AdaptiveTdeeResult = {
  /** Final expenditure estimate to base the target on (blended). */
  tdeeEstimate: number;
  mifflinTdee: number;
  /** Pure data-derived expenditure, or null if not computable. */
  learnedTdee: number | null;
  /** 0..1 — how much the learned estimate was trusted. */
  confidence: number;
  trendWeightLb: number | null;
  slopeLbPerWeek: number | null;
};

function round(n: number): number {
  return Math.round(n);
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/** Distinct weigh-ins by date (latest entry for a date wins), ascending by date. */
function normalizeWeights(samples: WeightSample[]): WeightSample[] {
  const byDate = new Map<string, number>();
  for (const s of samples) {
    if (typeof s.weightLbs === "number" && Number.isFinite(s.weightLbs) && s.weightLbs > 0) {
      byDate.set(s.date, s.weightLbs);
    }
  }
  return Array.from(byDate.entries())
    .map(([date, weightLbs]) => ({ date, weightLbs }))
    .sort((a, b) => (a.date < b.date ? -1 : 1));
}

function dayIndex(date: string, origin: string): number {
  const a = Date.parse(`${origin}T00:00:00`);
  const b = Date.parse(`${date}T00:00:00`);
  if (Number.isNaN(a) || Number.isNaN(b)) return 0;
  return Math.round((b - a) / 86_400_000);
}

/**
 * Least-squares linear fit of weight over time → a noise-resistant trend.
 * Returns null when there aren't ≥2 distinct weigh-ins.
 */
export function smoothWeightTrend(samples: WeightSample[]): WeightTrend | null {
  const points = normalizeWeights(samples);
  if (points.length < 2) return null;

  const origin = points[0].date;
  const xs = points.map((p) => dayIndex(p.date, origin));
  const ys = points.map((p) => p.weightLbs);
  const n = xs.length;
  const meanX = xs.reduce((a, b) => a + b, 0) / n;
  const meanY = ys.reduce((a, b) => a + b, 0) / n;

  let num = 0;
  let den = 0;
  for (let i = 0; i < n; i += 1) {
    num += (xs[i] - meanX) * (ys[i] - meanY);
    den += (xs[i] - meanX) ** 2;
  }
  const slopePerDay = den === 0 ? 0 : num / den;
  const intercept = meanY - slopePerDay * meanX;

  const spanDays = xs[xs.length - 1];
  const trendStart = intercept; // value at x=0 (first day)
  const trendWeightLb = intercept + slopePerDay * spanDays; // value at latest day

  return {
    trendWeightLb,
    slopeLbPerWeek: slopePerDay * 7,
    deltaLb: trendWeightLb - trendStart,
    weighInDays: n,
    spanDays
  };
}

/** Energy-balance back-calculation of expenditure (kcal/day). */
export function estimateExpenditure(
  avgDailyIntake: number,
  deltaTrendWeightLb: number,
  windowDays: number
): number {
  if (windowDays <= 0) return avgDailyIntake;
  const dailyStored = (deltaTrendWeightLb * KCAL_PER_LB) / windowDays;
  return avgDailyIntake - dailyStored;
}

/**
 * Confidence (0..1) that the learned estimate is meaningful. Needs both enough
 * logged-intake days and a long-enough weigh-in span; ramps smoothly above the
 * minimums and caps at 0.9 (we never fully abandon the physiological prior).
 */
export function confidenceFromData(input: {
  loggedDays: number;
  weighInSpanDays: number;
  weighInDays: number;
}): number {
  if (
    input.loggedDays < MIN_LOGGED_DAYS ||
    input.weighInSpanDays < MIN_WEIGH_IN_SPAN_DAYS ||
    input.weighInDays < 2
  ) {
    return 0;
  }
  const loggedScore = clamp((input.loggedDays - MIN_LOGGED_DAYS) / (21 - MIN_LOGGED_DAYS), 0, 1);
  const spanScore = clamp(
    (input.weighInSpanDays - MIN_WEIGH_IN_SPAN_DAYS) / (28 - MIN_WEIGH_IN_SPAN_DAYS),
    0,
    1
  );
  // Geometric-ish mean of the two, floored so a freshly-eligible user still gets
  // a real (if small) amount of adaptation, capped at 0.9.
  const combined = 0.3 + 0.6 * Math.min(loggedScore, spanScore) + 0.1 * ((loggedScore + spanScore) / 2);
  return clamp(combined, 0, 0.9);
}

/** Confidence-weighted blend, clamped to ±25% of Mifflin. */
export function blendTdee(mifflinTdee: number, learnedTdee: number, confidence: number): number {
  const blended = confidence * learnedTdee + (1 - confidence) * mifflinTdee;
  const lo = mifflinTdee * (1 - LEARNED_CLAMP_FRACTION);
  const hi = mifflinTdee * (1 + LEARNED_CLAMP_FRACTION);
  return round(clamp(blended, lo, hi));
}

/**
 * Calorie target from an expenditure estimate + a goal rate (lb/week, negative
 * = loss). Deficit/surplus is capped at ±25% of TDEE and the result floored at
 * minCalories.
 */
export function targetFromTdee(
  tdee: number,
  goalRateLbPerWeek: number,
  minCalories: number
): number {
  const rawAdjustment = (goalRateLbPerWeek * KCAL_PER_LB) / 7; // kcal/day (sign follows rate)
  const cap = tdee * MAX_DEFICIT_FRACTION;
  const adjustment = clamp(rawAdjustment, -cap, cap);
  return Math.max(minCalories, round(tdee + adjustment));
}

/** Full adaptive estimate: trend → learned expenditure → confidence blend. */
export function computeAdaptiveTdee(input: AdaptiveTdeeInput): AdaptiveTdeeResult {
  const trend = smoothWeightTrend(input.weightSamples);

  if (!trend) {
    return {
      tdeeEstimate: input.mifflinTdee,
      mifflinTdee: input.mifflinTdee,
      learnedTdee: null,
      confidence: 0,
      trendWeightLb: null,
      slopeLbPerWeek: null
    };
  }

  const learnedTdee = round(
    estimateExpenditure(input.avgDailyIntake, trend.deltaLb, input.windowDays)
  );
  const confidence = confidenceFromData({
    loggedDays: input.loggedDays,
    weighInSpanDays: trend.spanDays,
    weighInDays: trend.weighInDays
  });

  const tdeeEstimate =
    confidence > 0 ? blendTdee(input.mifflinTdee, learnedTdee, confidence) : input.mifflinTdee;

  return {
    tdeeEstimate,
    mifflinTdee: input.mifflinTdee,
    learnedTdee,
    confidence,
    trendWeightLb: round(trend.trendWeightLb),
    slopeLbPerWeek: Math.round(trend.slopeLbPerWeek * 100) / 100
  };
}
