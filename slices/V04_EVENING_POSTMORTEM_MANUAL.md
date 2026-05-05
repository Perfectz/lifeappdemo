# V04 — Evening Postmortem Manual

## User outcome
Patrick can close out the day manually: review planned tasks, mark outcomes, capture what happened, and close the DailyPlan.

## Why this slice exists
The app’s value comes from the closed feedback loop: plan, act, reflect, improve. This slice creates the evening loop before AI.

## Scope
Implement `/standup/evening` as a guided postmortem.

Steps:

1. Load today’s DailyPlan.
2. Show Main Quest and Side Quests.
3. Let Patrick mark each planned task complete, deferred, or still open.
4. Capture short reflection fields.
5. Save an evening postmortem record.
6. Mark DailyPlan as closed.

## Non-goals
No AI reflection yet. No report generation yet. No voice.

## UI contract
Route: `/standup/evening`

Reflection fields:

- Wins.
- Friction.
- Lessons learned.
- Tomorrow follow-ups.

Required states:

- No DailyPlan today: show option to create one or perform freeform postmortem.
- Already closed: show read-only summary with edit option.

## Data contract

```ts
type TaskOutcome = 'completed' | 'deferred' | 'left_open';

type EveningPostmortem = {
  id: string;
  date: string; // ISO date
  dailyPlanId?: string;
  taskOutcomes: Array<{
    taskId: string;
    outcome: TaskOutcome;
    note?: string;
  }>;
  wins?: string;
  friction?: string;
  lessonsLearned?: string;
  tomorrowFollowUps?: string;
  createdAt: string;
  updatedAt: string;
};
```

Rules:

- Completing a task sets task status to `done` and `completedAt`.
- Deferred tasks stay `todo` and may clear `plannedForDate` or move to tomorrow based on UI choice.
- Left-open tasks stay `todo`.
- Closing a DailyPlan sets `status='closed'`.

## API contract
No backend API required unless using server actions.

## Acceptance criteria

### AC1: Show planned tasks
Given a DailyPlan exists for today, when Patrick opens `/standup/evening`, then the Main Quest and Side Quests are shown.

### AC2: Mark complete
Given a planned task is shown, when Patrick marks it complete and saves, then the task status becomes done with `completedAt` set.

### AC3: Defer task
Given a planned task is shown, when Patrick marks it deferred and saves, then the task remains active and is not counted as completed.

### AC4: Capture reflection
Given Patrick enters wins, friction, lessons, and follow-ups, when he saves, then an EveningPostmortem record is stored for today.

### AC5: Close plan
Given the postmortem is saved, then today’s DailyPlan status becomes closed.

### AC6: No plan fallback
Given no DailyPlan exists today, when Patrick opens evening postmortem, then the app offers a freeform postmortem instead of crashing.

## Test criteria

### Unit tests
- Task outcome reducer updates task state correctly.
- EveningPostmortem schema validation.
- Closing a plan changes status to closed.

### Component tests
- Planned tasks render in postmortem.
- Reflection fields persist input.

### E2E tests
- Morning plan → evening postmortem → complete main task → dashboard completed count updates.
- No-plan fallback renders correctly.

## Codex prompt

```txt
Implement V04 Evening Postmortem Manual only.

Build /standup/evening to load today's DailyPlan, show planned tasks, mark task outcomes, capture reflection fields, store EveningPostmortem, and close the DailyPlan.
Add unit/component/e2e tests for task outcome behavior and plan closing.
Do not implement AI reflection, reports, metrics, voice, or reminders.
```

## Review checklist
- Does the evening flow help close the loop?
- Does marking a task complete update the task list and dashboard?
- Does no-plan behavior avoid dead ends?
