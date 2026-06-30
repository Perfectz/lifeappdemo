# Vertical Slice V17 — Adaptive TDEE Nutrition

## Slice ID
V17

## Slice name
Adaptive TDEE — calorie/macro targets that learn from intake vs. weight trend.

## User outcome
After ~1–2 weeks of logging food and weight, Patrick's daily calorie + macro target
is driven by his **measured** energy expenditure (back-calculated from how his weight
actually responded to what he ate), not a textbook estimate — and it self-corrects
every week as new data arrives.

## Why this slice exists
The competitive review found MacroFactor's single defensible advantage is its
**adaptive TDEE**: it reverse-calculates true expenditure from the user's weight-trend
vs. logged intake and updates targets weekly, instead of trusting a static
Mifflin–St Jeor formula. LifeQuest today ships only the static formula
(`computeCalorieBudget`) plus an AI day-nudge (`nutritionTargetClient`). This slice
closes that gap while keeping LifeQuest's edges (photo/voice logging, gamification,
identity) — i.e. match the science, keep the UX.

It must **degrade gracefully**: with little/no data it behaves exactly like today
(Mifflin baseline), and it blends toward the learned estimate as confidence grows, so
the feature is safe and useful from day one.

## Scope
1. **Pure estimation domain** (`src/domain/adaptiveTdee.ts`):
   - `smoothWeightTrend(samples)` — robust weight trend from noisy daily weigh-ins
     (linear regression or EWMA over the window) → returns trend weight + slope (lb/week).
   - `estimateExpenditure(intakeSamples, weightTrend, windowDays)` — energy-balance
     back-calc: `expenditure ≈ avgDailyIntake − (ΔtrendWeightLb × 3500 / windowDays)`.
   - `confidenceFromData({ loggedDays, weighInDays, windowDays })` → 0..1
     (needs enough *logged-intake* days and ≥2 spaced weigh-ins to be > 0).
   - `blendTdee(mifflinTdee, learnedTdee, confidence)` — confidence-weighted blend
     (`conf·learned + (1−conf)·mifflin`), clamped to ±25% of the Mifflin estimate so a
     bad data window can't produce an absurd expenditure.
   - `targetFromTdee(tdee, goalRateLbPerWeek, minCalories)` — `tdee − goalRate×3500/7`,
     floored at `minCalories`, and the weekly deficit/surplus capped (≤ ~25% of TDEE).
   - Macro split reuses the existing rules (protein anchored to target weight, fat ~25%
     of kcal, carbs remainder) from `calorieBudget.ts`.
2. **Wire into the existing pipeline** (`src/client/nutritionTarget.ts`):
   - `buildTargetComputation` computes the **adaptive** baseline (blend) instead of the
     raw Mifflin number when confidence > 0; otherwise unchanged.
   - The existing AI day-nudge (`/api/ai/nutrition-target`) still runs **on top of** the
     adaptive baseline (training/sleep adjustments within guardrails). New `source`
     value `"adaptive"` (deterministic, learned) distinct from `"computed"` (Mifflin only).
3. **Goal rate** in `HealthGoals`: add optional `weeklyWeightChangeTargetLbs`
   (e.g. −1.0 for ~1 lb/week loss; default derived from `lose`→−1.0 / `maintain`→0).
4. **Weekly expenditure snapshot** (`src/data/expenditureEstimateRepository.ts`):
   store one `{ date, tdeeEstimate, confidence, trendWeightLb }` per recompute so the UI
   can show the trend and "your TDEE estimate changed" transparency.
5. **UI** (`src/components/NutritionDiary.tsx`): extend the existing target-meta row to
   show the learned estimate + confidence (e.g. "Adaptive · TDEE ≈ 2,980 kcal · learning
   62%"), and a one-line "we updated your estimate" note when it shifts week-over-week.

## Non-goals
- **Collaborative mode** (user sets macro ratios, algorithm sets calories only) —
  later slice. MVP is "coached": algorithm sets calories + macros.
- Body-fat %, lean-mass, or multi-compartment models — energy balance only.
- Per-meal AI photo macro recognition — separate track.
- Backfilling historical daily targets — adaptive applies to **today** going forward.
- Changing the AI day-nudge prompt's guardrails (kept as-is from V-nutrition).

## UI contract
- **Route:** existing `/nutrition` (no new route).
- **Components:** `NutritionDiary` target-meta row gains:
  - Badge `Adaptive` (vs existing `Auto`/`AI-tuned`/`Manual`).
  - Subtext: `TDEE ≈ {estimate} kcal · learning {confidence%}` and the goal-rate
    (`−1 lb/wk`).
  - When `confidence === 0`: show `Auto` exactly as today (no adaptive claims).
  - Optional expander "How this was calculated" → trend weight, window, last update.
- **States:** loading (spinner on Recalculate), insufficient-data (Mifflin fallback,
  no adaptive badge), adaptive-active, manual-override (unchanged).

## Data contract
- New domain `AdaptiveTdeeResult { tdeeEstimate:number; mifflinTdee:number;
  learnedTdee:number|null; confidence:number; trendWeightLb:number|null;
  slopeLbPerWeek:number|null; windowDays:number; loggedDays:number }`.
- `HealthGoals` gains optional `weeklyWeightChangeTargetLbs?: number`
  (validate: finite, between −2 and +1.5); update `isHealthGoals`, `withGoalEdits`,
  and the goal editor.
- `DailyNutritionTarget.source` union adds `"adaptive"` (update
  `nutritionTargetSources`, `nutritionTargetSourceLabel`, guards, and any tests).
- New repo `expenditureEstimateRepository` → key
  `lifequest.expenditureEstimates.v1`, array of `ExpenditureEstimate
  { date:IsoDate; tdeeEstimate:number; confidence:number; trendWeightLb:number;
  createdAt }`, bounded to ~180 entries. Synced via the generic snapshot (no
  dedicated Supabase table).
- Inputs read from existing repos only: `metricEntries` (weightLbs over time),
  `foodEntries` (daily calorie sums), `bodyProfile`, `healthGoals`. No new logging UI.

## API contract
- **No new endpoint.** Estimation is pure + client-side (like the Mifflin calc today).
- The existing `POST /api/ai/nutrition-target` is reused unchanged; the client passes
  the **adaptive** baseline in the `baseline` field, so the AI nudges around the learned
  number. The 503/deterministic fallback path is preserved.

## Acceptance criteria
- **Given** ≥10 logged-intake days and ≥2 weigh-ins spanning ≥10 days in the window,
  **when** the daily target is computed, **then** `source` is `"adaptive"`, the calorie
  target equals `blend(mifflin, learned, confidence) − goalRate`, floored at min
  calories, and the meta row shows the TDEE estimate + confidence.
- **Given** the user ate ~maintenance but trended **up** 0.5 lb/week, **when**
  expenditure is estimated, **then** the learned TDEE is **lower** than Mifflin and the
  calorie target drops accordingly (self-correction).
- **Given** fewer than the minimum logged/weigh-in days, **when** computed, **then**
  `source` is `"computed"` (Mifflin only), confidence is 0, and the UI shows no adaptive
  claim — identical to current behavior.
- **Given** a noisy day spike (water weight), **when** the trend is smoothed, **then**
  a single outlier moves the estimate by less than a naive first-vs-last calc would.
- **Given** the learned estimate would imply an absurd expenditure (e.g. data gap),
  **when** blended, **then** the result is clamped to ±25% of Mifflin and the deficit
  capped at ≤25% of TDEE / never below min calories.
- **Given** the user sets `weeklyWeightChangeTargetLbs = −1.5`, **when** computed,
  **then** the deficit reflects it but is capped by the safety bounds.
- **Given** the OpenAI key is absent, **when** computed, **then** the adaptive
  deterministic target is used (AI nudge skipped) and still labeled `"adaptive"`.

## Test criteria
- **Unit (domain, pure):** `smoothWeightTrend` (slope sign, outlier resistance),
  `estimateExpenditure` (energy-balance math incl. the up-trend → lower-TDEE case),
  `confidenceFromData` (0 below thresholds, monotonic increase), `blendTdee`
  (confidence weighting + ±25% clamp), `targetFromTdee` (deficit math, min-calorie
  floor, deficit cap).
- **Unit (client):** `buildTargetComputation` returns `"adaptive"` with seeded
  metrics+foods, `"computed"` when sparse; `getOrComputeDailyTarget` still caches and
  falls back to deterministic on AI failure.
- **Component:** `NutritionDiary` renders the Adaptive badge + estimate/confidence with
  rich data; renders the plain Auto state with sparse data.
- **Security/safety:** assert the calorie floor + deficit cap can never be violated by
  crafted inputs (table-driven).
- **AI behavior:** the AI-nudge result is still clamped to the band around the adaptive
  baseline (reuse existing guardrail tests with an adaptive baseline).

## Codex prompt
```txt
Implement only vertical slice V17 (Adaptive TDEE Nutrition). Follow the spec exactly.
Build the pure estimation domain (src/domain/adaptiveTdee.ts) with full unit tests
first, then wire it into src/client/nutritionTarget.ts so the daily target's baseline
becomes the confidence-blended learned TDEE (source "adaptive"), keeping the Mifflin
fallback when data is sparse and the existing AI day-nudge + guardrails on top. Add the
weeklyWeightChangeTargetLbs goal field, the expenditureEstimate repo, the "adaptive"
source value, and the NutritionDiary meta-row UI. Do not add a new API route. Keep the
calorie floor and deficit cap inviolable. Update all affected guards/tests. Run
npm run verify and report the diff, tests added, and what to review.
```

## Review checklist
- Energy-balance math is correct and unit-tested (especially up-trend → lower TDEE).
- Safety bounds hold under adversarial inputs (floor, ±25% clamp, ≤25% deficit).
- Sparse-data path is byte-for-byte the current behavior (no regressions to V-nutrition).
- Transparency: the UI clearly distinguishes Adaptive vs Auto vs AI-tuned vs Manual and
  shows the estimate + confidence so the number feels trustworthy.
- `npm run verify` green; manual check on `/nutrition` with seeded history.
