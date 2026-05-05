# V10 — AI Metrics and Journal Tools

## User outcome
Patrick can tell the AI about his metrics or reflections in natural language, and the AI can propose validated metric/journal entries for confirmation.

## Why this slice exists
This reduces input friction. Patrick explicitly wanted to talk to the app when he is too lazy to fill out forms.

## Scope
Add AI tool proposals for:

- Log metric entry.
- Create journal entry.
- Update journal entry, optional if simple.

## Non-goals
No medical advice. No health diagnosis. No automatic wearable sync. No voice yet.

## UI contract
In AI coach UI:

- Proposed metric entries display readable values before confirmation.
- Proposed journal entries display prompt/type/content before confirmation.
- Confirm applies entry.
- Reject discards entry.

## Data contract
Extend `AIToolProposal.toolName` with:

- `log_metric`
- `create_journal_entry`

Metric payload:

```ts
type LogMetricPayload = {
  date: string;
  checkInType: 'morning' | 'evening' | 'freeform';
  weightLbs?: number;
  sleepHours?: number;
  energyLevel?: 1 | 2 | 3 | 4 | 5;
  moodLevel?: 1 | 2 | 3 | 4 | 5;
  steps?: number;
  workoutSummary?: string;
  bloodPressureSystolic?: number;
  bloodPressureDiastolic?: number;
  notes?: string;
};
```

Journal payload:

```ts
type CreateJournalEntryPayload = {
  date: string;
  type: 'morning_intention' | 'evening_reflection' | 'lesson' | 'freeform';
  prompt?: string;
  content: string;
};
```

## API contract
Reuse `/api/ai/chat` proposals and `/api/ai/tools/confirm`.

Health safety:

- AI may summarize patterns.
- AI must not diagnose, prescribe, or make medical claims.
- Blood pressure values can be logged, but advice should be bounded: “consider discussing with a healthcare professional” when relevant.

## Acceptance criteria

### AC1: Propose metric from chat
Given Patrick says “I slept 6 hours and my energy is 2,” when the AI responds, then it proposes a metric entry with sleepHours 6 and energyLevel 2.

### AC2: Confirm metric
Given a metric proposal exists, when Patrick confirms it, then a MetricEntry is stored and appears on `/metrics` and dashboard snapshot.

### AC3: Reject metric
Given a metric proposal exists, when Patrick rejects it, then no MetricEntry is created.

### AC4: Propose journal entry
Given Patrick says “I learned that starting earlier helps me avoid rushing,” when the AI responds, then it proposes a lesson journal entry.

### AC5: Validate health values
Given an AI-proposed metric has invalid values, when confirmation is attempted, then the backend rejects it safely.

### AC6: No diagnosis
Given Patrick shares blood pressure values, when the AI responds, then it logs/summarizes without diagnosing or prescribing treatment.

## Test criteria

### Unit tests
- Metric tool payload validation.
- Journal tool payload validation.
- Invalid metric values rejected.

### Integration tests
- Mock AI metric proposal → confirm → entry stored.
- Mock AI journal proposal → confirm → entry stored.
- Invalid health payload fails safely.

### AI behavior tests
- Prompt about blood pressure does not produce diagnosis or treatment.
- Prompt about low sleep suggests lighter planning in bounded language.

### E2E tests
- Chat metric → confirm → dashboard updates.
- Chat lesson → confirm → journal page updates.

## Codex prompt

```txt
Implement V10 AI Metrics and Journal Tools only.

Extend the existing proposal/confirmation system with log_metric and create_journal_entry.
Show readable confirmation cards for proposed metrics and journal entries.
Validate all payloads on the backend before mutation.
Add safety prompt boundaries so AI does not diagnose or prescribe medical treatment.
Add tests for valid proposals, invalid proposals, confirmation, rejection, and health-safety behavior.
Do not implement voice, wearable import, or full morning/evening agent flows yet.
```

## Review checklist
- Can you naturally tell the AI what happened instead of filling forms?
- Does the app ask confirmation before storing sensitive data?
- Is the health boundary respected?
