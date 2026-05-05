# V05 — AM/PM Metrics Check-In

## User outcome
Patrick can log morning and evening metrics manually, and the dashboard can show his latest health/energy snapshot.

## Why this slice exists
Metrics provide the context the AI coach will later use for workload suggestions, sleep-aware planning, and progress reports.

## Scope
Implement manual metric logging for morning and evening check-ins.

Supported metric fields for MVP:

- Weight.
- Sleep duration.
- Energy level 1–5.
- Mood 1–5.
- Steps.
- Workout summary.
- Blood pressure systolic/diastolic.
- Notes.

## Non-goals
No Samsung Health import. No medical advice. No charts yet unless trivial. No automatic wearable sync.

## UI contract
Route: `/metrics`

Required UI:

- Date selector defaults to today.
- Check-in type: morning or evening.
- Form for supported fields.
- Save button.
- Recent entries list.
- Dashboard metric snapshot displays latest values.

Health boundary copy:

> This app tracks personal patterns and reflections. It does not provide medical diagnosis or treatment advice.

## Data contract

```ts
type CheckInType = 'morning' | 'evening' | 'freeform';
type MetricSource = 'manual' | 'samsung_export' | 'health_connect' | 'demo';

type MetricEntry = {
  id: string;
  date: string; // ISO date
  checkInType: CheckInType;
  source: MetricSource;
  weightLbs?: number;
  sleepHours?: number;
  energyLevel?: 1 | 2 | 3 | 4 | 5;
  moodLevel?: 1 | 2 | 3 | 4 | 5;
  steps?: number;
  workoutSummary?: string;
  bloodPressureSystolic?: number;
  bloodPressureDiastolic?: number;
  notes?: string;
  recordedAt: string;
  createdAt: string;
  updatedAt: string;
};
```

Validation:

- Weight must be positive.
- Sleep hours must be between 0 and 24.
- Energy and mood must be 1–5.
- Steps must be non-negative integer.
- Blood pressure fields must be positive integers if provided.

## API contract
No backend API required unless using server actions.

## Acceptance criteria

### AC1: Log morning metrics
Given Patrick opens `/metrics`, when he selects morning and saves valid values, then a morning MetricEntry is stored.

### AC2: Log evening metrics
Given Patrick opens `/metrics`, when he selects evening and saves valid values, then an evening MetricEntry is stored.

### AC3: Validation
Given Patrick enters invalid metric values, when he submits the form, then the app shows validation messages and does not store invalid data.

### AC4: Recent entries
Given metric entries exist, when Patrick opens `/metrics`, then recent entries appear with date, check-in type, and key values.

### AC5: Dashboard snapshot
Given a latest metric entry exists, when Patrick opens `/dashboard`, then the dashboard shows latest energy, mood, sleep, and steps if available.

### AC6: Health boundary
Given Patrick views the metrics page, then the app shows a clear non-medical boundary message.

## Test criteria

### Unit tests
- Metric schema validates all supported fields.
- Invalid values are rejected.
- Latest metric selector returns newest entry.

### Component tests
- Metric form saves valid data.
- Metric form displays validation errors.
- Recent entries list renders.

### E2E tests
- Log morning metrics → dashboard shows latest snapshot.
- Invalid blood pressure/negative steps are blocked.

## Codex prompt

```txt
Implement V05 AM/PM Metrics Check-In only.

Build MetricEntry data model, validation, local persistence, /metrics UI, recent entries list, and dashboard latest-metric snapshot.
Include health boundary copy.
Add unit/component/e2e tests for validation, persistence, and dashboard snapshot.
Do not implement Samsung Health import, AI health advice, charts, or medical recommendations.
```

## Review checklist
- Is metric entry fast enough to do twice a day?
- Are invalid values blocked?
- Is the medical boundary clear?
- Does dashboard context improve?
