# V02 — Today Command Center

## User outcome
Patrick can open the dashboard and see a useful snapshot of today: active tasks, planned tasks, latest metrics placeholder, and next suggested action.

## Why this slice exists
The dashboard becomes the hub that later connects tasks, metrics, stand-ups, postmortems, reports, and AI. It should be useful before AI exists.

## Scope
Build a real `/dashboard` backed by stored tasks.

Dashboard sections:

- Today header with date.
- Main Quest placeholder if no DailyPlan exists.
- Active tasks planned for today.
- Backlog count.
- Completed today count.
- Metric snapshot placeholder.
- Call-to-action buttons:
  - Start Morning Stand-Up.
  - Open Quest Log.
  - Log Metrics.
  - Start Evening Postmortem.

## Non-goals
Do not implement DailyPlan yet. Do not implement metrics entry yet. Do not implement AI summary.

## UI contract
Route: `/dashboard`

The dashboard should use reusable components where helpful:

- `StatusPanel`
- `QuestCard`
- `CommandButton`
- `SectionHeader`

Keep reusable components small. Do not create a giant design system.

## Data contract
Read from existing `Task` records.

Derived values:

- `plannedTodayTasks`: active tasks where `plannedForDate === today`.
- `activeBacklogCount`: active tasks without today as planned date.
- `completedTodayCount`: tasks where `completedAt` is today.

## API contract
No new API required.

## Acceptance criteria

### AC1: Dashboard shows today
Given Patrick opens `/dashboard`, then he sees today’s date and the LifeQuest OS command center.

### AC2: Planned tasks appear
Given tasks exist with `plannedForDate` equal to today, when Patrick opens the dashboard, then those tasks appear in the Today section.

### AC3: Backlog count appears
Given active tasks exist without today’s planned date, when Patrick opens the dashboard, then the backlog count is accurate.

### AC4: Completed count appears
Given tasks were completed today, when Patrick opens the dashboard, then completed today count is accurate.

### AC5: CTA navigation works
Given Patrick clicks dashboard CTA buttons, then each button navigates to the correct route.

## Test criteria

### Unit tests
- Date helpers correctly detect today.
- Derived dashboard stats are correct.

### Component tests
- Dashboard renders empty state.
- Dashboard renders planned tasks.

### E2E tests
- Create a task planned for today, visit dashboard, see it listed.
- CTA buttons navigate correctly.

## Codex prompt

```txt
Implement V02 Today Command Center only.

Use existing Task persistence from V01.
Build /dashboard as a real snapshot of today's tasks with derived counts and CTA navigation.
Add tests for derived dashboard stats and route navigation.
Do not implement DailyPlan, metrics entry, AI summaries, or reports yet.
```

## Review checklist
- Does dashboard feel like the app’s home base?
- Can you understand today’s situation in 10 seconds?
- Are derived counts correct after completing tasks?
