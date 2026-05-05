# LifeQuest OS — Vertical Slice Spec Pack

This pack breaks the MVP into small, steerable, spec-driven build steps for Codex.

The goal is not to ask Codex to “build the app.” The goal is to give Codex **one narrow end-to-end slice at a time**, with acceptance criteria and tests, then review the diff before moving on.

## Product shorthand

Working name: **LifeQuest OS**

Core loop:

1. Morning stand-up with the AI.
2. Task prioritization and planning.
3. Manual health/energy metrics.
4. Evening postmortem with lessons learned.
5. Markdown report export for LinkedIn/content workflows.
6. Later: voice mode and Galaxy Watch/Samsung Health import.

## How to use this pack in Codex

Give Codex the original context pack plus this vertical-slice pack.

Then start with this prompt:

```txt
Read the full context pack and the vertical slice spec pack.

Do not build the whole app.
Implement only Slice V00 first.
Follow the spec exactly.
Write or update tests for the acceptance criteria.
Keep the implementation minimal, typed, and modular.
After the slice is complete, summarize the diff, the tests added, and what should be reviewed before V01.
```

For each next step, paste the next slice file and say:

```txt
Implement only this next vertical slice.
Do not jump ahead.
Do not add features outside the slice.
Keep all previous tests passing.
```

## Build philosophy

Each slice should produce a user-visible or system-verifiable outcome.

Avoid horizontal-only tasks like:

- “Build the database.”
- “Build all UI components.”
- “Build all AI tools.”

Prefer vertical slices like:

- “Create one task and see it appear on dashboard.”
- “Run a morning stand-up and save a DailyPlan.”
- “Generate a Markdown report from today’s actual stored data.”

## Suggested MVP tracks

### MVP-0: Local deterministic app
Build slices V00–V07.

Result: usable app without AI dependency.

### MVP-1: Text AI coach
Build slices V08–V12.

Result: AI can read context, suggest plans, update tasks/metrics/journal entries through safe tool calls, and generate reports.

### MVP-1.5: Portfolio polish and future integrations
Build slices V13–V16.

Result: installable PWA, voice-mode foundation, health-import foundation, and portfolio-ready demo polish.


---

# Spec-Driven Workflow for Codex

Use this workflow for every vertical slice.

## 1. Slice spec

Every slice should define:

- User outcome.
- Scope.
- Non-goals.
- UI contract.
- Data contract.
- API contract, if applicable.
- Acceptance criteria.
- Test criteria.
- Review checklist.

## 2. Implementation discipline

Codex should:

- Implement the smallest version that satisfies the slice.
- Keep code typed with TypeScript.
- Avoid fake data unless explicitly labeled as demo data.
- Avoid hidden global state.
- Avoid exposing secrets in frontend code.
- Keep AI calls server-side.
- Validate API/tool payloads.
- Add tests before or during implementation.

## 3. Review gate

Before accepting a slice, verify:

- Acceptance criteria are met.
- Tests pass.
- No unrelated features were added.
- Data shape stayed compatible with future slices.
- User-visible wording matches the JRPG/life-coach tone without hurting usability.

## 4. Recommended test stack

Use whatever Codex installs or the project already has, but a practical default is:

- Unit tests: Vitest.
- Component tests: React Testing Library.
- E2E tests: Playwright.
- Schema validation: Zod.
- Type checks: TypeScript.
- Linting: ESLint.

## 5. Codex steering pattern

Use this pattern when prompting Codex:

```txt
Implement [slice name].

Constraints:
- Do not implement future slices.
- Do not add placeholder features unless the spec requests them.
- Preserve existing tests.
- Add tests for the acceptance criteria.
- Use typed data contracts.
- Summarize the diff after implementation.

Acceptance criteria:
[paste criteria]

Test criteria:
[paste criteria]
```

## 6. How to correct Codex when it overbuilds

Use this correction prompt:

```txt
You added functionality outside the current slice.
Please revert or isolate anything not required by the current acceptance criteria.
The slice should stay narrow and pass its tests.
```

## 7. How to correct Codex when it under-tests

Use this correction prompt:

```txt
The implementation is not acceptable until tests cover the listed acceptance criteria.
Add unit, integration, or e2e tests as appropriate.
Do not change product scope.
```


---

# Vertical Slice Roadmap

## MVP-0 — Local deterministic app

These slices prove the daily loop works before adding AI complexity.

| Slice | Name | User-visible outcome |
|---|---|---|
| V00 | Walking Skeleton | App runs as a PWA shell with typed routes, layout, and test harness. |
| V01 | Quest Log: Create and Complete Task | User can create, view, complete, and archive tasks. |
| V02 | Today Command Center | Dashboard shows today's tasks, plan status, and metric summary. |
| V03 | Morning Stand-Up Manual | User can run a non-AI morning planning flow and save a DailyPlan. |
| V04 | Evening Postmortem Manual | User can close the day, mark outcomes, and capture lessons. |
| V05 | AM/PM Metrics Check-In | User can log morning/evening metrics and see them on dashboard. |
| V06 | Journal and Lesson Capture | User can create reflection entries linked to a date/session. |
| V07 | Markdown Daily Report Export | User can generate and download a report from real stored data. |

## MVP-1 — Text AI coach

These slices add the cloud AI safely and incrementally.

| Slice | Name | User-visible outcome |
|---|---|---|
| V08 | AI Chat Read-Only Context | User can chat with AI; AI can read compact app context but cannot mutate data. |
| V09 | AI Task Tools with Confirmation | AI can propose task changes; user confirms before mutation. |
| V10 | AI Metrics and Journal Tools | AI can log metrics/reflections with validation and confirmation. |
| V11 | AI Morning Stand-Up | AI leads planning and creates/updates DailyPlan through tools. |
| V12 | AI Evening Postmortem and Report | AI closes tasks, captures lessons, and generates the report. |

## MVP-1.5 — Installation, voice, wearable foundations, portfolio polish

| Slice | Name | User-visible outcome |
|---|---|---|
| V13 | Android PWA Install and Offline Shell | App installs cleanly and loads a useful offline shell. |
| V14 | Voice Session Alpha | User can start a voice-mode shell with Realtime session architecture and transcript handoff. |
| V15 | Health Import Alpha | User can import Samsung Health-style exported files and normalize records. |
| V16 | Portfolio Demo and JRPG Polish | App has demo mode, better visuals, and screenshots/reports suitable for LinkedIn. |

## Recommended order

Build in order. Do not start AI until V00–V07 are working.

Reason: the AI agent needs reliable tools and stored data. If the local workflows are not stable, the AI will amplify confusion instead of reducing friction.


---

# Vertical Slice Template

Use this template to create or modify future slices.

## Slice ID
VXX

## Slice name
Name here.

## User outcome
One sentence describing what Patrick can do after this slice.

## Why this slice exists
Explain the product risk this reduces.

## Scope
What to build.

## Non-goals
What not to build yet.

## UI contract
Routes, screens, components, visible states.

## Data contract
Entities, fields, validation, persistence expectations.

## API contract
Endpoints, request/response shapes, server actions, or none.

## Acceptance criteria
Use Given/When/Then.

## Test criteria
Define unit, integration, e2e, security, and AI behavior tests as relevant.

## Codex prompt
A ready-to-paste prompt for the slice.

## Review checklist
What Patrick should inspect before moving to the next slice.


---

# Codex Slice Prompts

Use these prompts one at a time.

## Global instruction to keep Codex narrow

```txt
You are building LifeQuest OS from the provided context pack.
Work spec-first and test-first where practical.
Only implement the current vertical slice.
Do not add future features.
Keep all changes typed, minimal, and modular.
Add or update tests for the listed acceptance criteria.
At the end, summarize:
1. Files changed.
2. Acceptance criteria satisfied.
3. Tests added or updated.
4. Commands to run.
5. Risks or follow-up questions.
```

## V00 prompt

```txt
Implement V00 Walking Skeleton only. Read slices/V00_WALKING_SKELETON.md and follow it exactly.
```

## V01 prompt

```txt
Implement V01 Quest Log Task CRUD only. Read slices/V01_QUEST_LOG_TASK_CRUD.md and follow it exactly. Do not implement stand-up or AI yet.
```

## V02 prompt

```txt
Implement V02 Today Command Center only. Read slices/V02_TODAY_COMMAND_CENTER.md and follow it exactly. Use existing task data.
```

## V03 prompt

```txt
Implement V03 Morning Stand-Up Manual only. Read slices/V03_MORNING_STANDUP_MANUAL.md and follow it exactly. Keep it useful without AI.
```

## V04 prompt

```txt
Implement V04 Evening Postmortem Manual only. Read slices/V04_EVENING_POSTMORTEM_MANUAL.md and follow it exactly.
```

## V05 prompt

```txt
Implement V05 AM/PM Metrics Check-In only. Read slices/V05_AM_PM_METRICS_CHECKIN.md and follow it exactly. Include health boundary copy.
```

## V06 prompt

```txt
Implement V06 Journal and Lesson Capture only. Read slices/V06_JOURNAL_AND_LESSON_CAPTURE.md and follow it exactly.
```

## V07 prompt

```txt
Implement V07 Markdown Daily Report Export only. Read slices/V07_MARKDOWN_DAILY_REPORT_EXPORT.md and follow it exactly. Reports must not invent missing data.
```

## V08 prompt

```txt
Implement V08 AI Chat with Read-Only App Context only. Read slices/V08_AI_CHAT_READ_ONLY_CONTEXT.md and follow it exactly. Server-side OpenAI key only. Mock AI in tests.
```

## V09 prompt

```txt
Implement V09 AI Task Tools with Confirmation only. Read slices/V09_AI_TASK_TOOLS_WITH_CONFIRMATION.md and follow it exactly. No silent mutation.
```

## V10 prompt

```txt
Implement V10 AI Metrics and Journal Tools only. Read slices/V10_AI_METRICS_AND_JOURNAL_TOOLS.md and follow it exactly. Keep health safety boundaries.
```

## V11 prompt

```txt
Implement V11 AI Morning Stand-Up Agent only. Read slices/V11_AI_MORNING_STANDUP_AGENT.md and follow it exactly. Save DailyPlan only after confirmation.
```

## V12 prompt

```txt
Implement V12 AI Evening Postmortem and Report only. Read slices/V12_AI_EVENING_POSTMORTEM_AND_REPORT.md and follow it exactly. All mutations require confirmation.
```

## V13 prompt

```txt
Implement V13 Android PWA Install and Offline Shell only. Read slices/V13_ANDROID_PWA_INSTALL_AND_OFFLINE_SHELL.md and follow it exactly.
```

## V14 prompt

```txt
Implement V14 Voice Session Alpha only. Read slices/V14_VOICE_SESSION_ALPHA.md and follow it exactly. Use ephemeral credentials only and mock tests.
```

## V15 prompt

```txt
Implement V15 Health Import Alpha only. Read slices/V15_HEALTH_IMPORT_ALPHA.md and follow it exactly. Manual import first, no direct Samsung API yet.
```

## V16 prompt

```txt
Implement V16 Portfolio Demo and JRPG Polish only. Read slices/V16_PORTFOLIO_DEMO_AND_JRPG_POLISH.md and follow it exactly. Demo data must be clearly labeled and separable from real data.
```


---

# Acceptance Criteria Summary

This is a quick checklist version. The detailed Given/When/Then criteria are in each slice file.

## MVP-0 local app

### V00 Walking Skeleton
- App loads.
- Core routes exist.
- `/api/health` works.
- PWA basics exist.
- No secrets exposed.

### V01 Quest Log
- Create task.
- Validate empty title.
- Complete task.
- Reopen task.
- Archive task.
- Persist through refresh.

### V02 Dashboard
- Shows today.
- Shows planned tasks.
- Shows backlog count.
- Shows completed-today count.
- CTA navigation works.

### V03 Morning Stand-Up Manual
- Shows active tasks.
- Quick task creation works.
- Saves DailyPlan.
- Enforces max Side Quests.
- Dashboard reflects plan.
- Edits existing plan instead of duplicating.

### V04 Evening Postmortem Manual
- Shows planned tasks.
- Marks tasks complete.
- Defers tasks.
- Captures reflection.
- Closes plan.
- Handles no-plan fallback.

### V05 Metrics
- Logs morning metrics.
- Logs evening metrics.
- Validates values.
- Shows recent entries.
- Updates dashboard snapshot.
- Shows health boundary.

### V06 Journal
- Creates entry.
- Prompt picker works.
- Edits entry.
- Deletes entry.
- Supports date filtering/highlighting.

### V07 Markdown Report
- Generates from real stored data.
- Labels missing data honestly.
- Downloads `.md` file.
- Copies to clipboard.
- Persists latest report.

## MVP-1 AI coach

### V08 AI Chat Read-Only
- Sends chat message.
- Uses app context.
- Does not mutate data.
- Keeps key server-side.
- Handles errors safely.

### V09 AI Task Tools
- Proposes task creation.
- Confirm applies.
- Reject does not apply.
- Completes task via proposal.
- Validates payload.
- Shows audit trail.

### V10 AI Metrics/Journal Tools
- Proposes metric from chat.
- Confirm metric applies.
- Reject metric blocks mutation.
- Proposes journal entry.
- Validates health values.
- Does not diagnose.

### V11 AI Morning Stand-Up
- Starts AI stand-up.
- Suggests priorities.
- Proposes new tasks.
- Confirms plan.
- Reject/edit plan works.
- Controls overload.

### V12 AI Evening Postmortem
- Starts AI postmortem.
- Closes tasks via confirmation.
- Captures lessons.
- Creates tomorrow follow-ups.
- Generates report.
- Labels missing data honestly.
- Closes DailyPlan.

## MVP-1.5 polish/integrations

### V13 PWA
- Manifest valid.
- Installable.
- Offline shell works.
- Offline AI boundary works.
- No cache secrets.

### V14 Voice
- Voice entry point visible.
- Server creates ephemeral session.
- Permanent key not exposed.
- Permission handling works.
- Transcript handoff works.

### V15 Health Import
- Upload file.
- Preview before import.
- Confirm import.
- Invalid files fail safely.
- Duplicate protection.
- Dashboard updates.

### V16 Portfolio polish
- Demo mode seed.
- Demo label visible.
- Reset demo data.
- Screenshot-ready dashboard.
- Report presentation polished.
- Accessibility baseline.


---

# Test Criteria Summary

Use this as the master quality gate.

## Core commands Codex should maintain

Exact commands may vary by setup, but the project should have equivalents for:

```bash
npm run typecheck
npm run lint
npm run test
npm run test:e2e
npm run build
```

## Unit test categories

- Task schema and reducers.
- DailyPlan schema and validation.
- EveningPostmortem schema and task outcome reducer.
- MetricEntry schema and validation.
- JournalEntry schema and validation.
- Report generator.
- Date helpers.
- AI context builder.
- AI tool payload validation.
- Health import parser/normalizer.
- Demo data seed/reset.

## Integration test categories

- `/api/health`.
- `/api/ai/chat` validation and mocked OpenAI calls.
- `/api/ai/tools/confirm` validation and mutation behavior.
- `/api/realtime/session` ephemeral credential behavior.
- Health import parse/confirm flow if implemented server-side.

## E2E flows

### Flow 1: Manual task loop
Create task → dashboard shows task → complete task → dashboard completed count updates.

### Flow 2: Manual daily loop
Create tasks → morning stand-up saves plan → dashboard shows plan → evening postmortem closes plan.

### Flow 3: Metrics loop
Log morning metrics → dashboard snapshot updates → log evening metrics → recent entries show both.

### Flow 4: Journal/report loop
Create journal entry → complete postmortem → generate Markdown report → copy/download.

### Flow 5: AI read-only loop
Ask AI a question with mocked response → AI uses context → no data mutation.

### Flow 6: AI mutation loop
Ask AI to create task → proposal appears → reject no mutation → ask again → confirm mutation.

### Flow 7: AI daily loop
AI morning stand-up proposes plan → confirm → AI evening postmortem closes tasks/report.

### Flow 8: PWA/Android smoke
Open on mobile viewport → navigate primary routes → install/offline shell check.

## Security tests

- No permanent OpenAI key in frontend bundle.
- No permanent key returned from `/api/realtime/session`.
- AI tool payloads cannot execute arbitrary tool names.
- API responses do not leak secrets in errors.
- Service worker does not cache sensitive AI responses.
- Health data is not automatically sent to AI without explicit context use.

## AI behavior tests

These can be scripted prompts with mocked model responses or prompt snapshots.

- AI does not invent missing metrics.
- AI does not diagnose medical conditions.
- AI limits morning plan to one Main Quest and up to three Side Quests.
- AI asks fewer questions when enough context exists.
- AI proposes confirmations before mutations.
- AI produces LinkedIn source material without pretending it posted publicly.

## Manual QA checklist

- Can Patrick complete a morning check-in in under 5 minutes?
- Can Patrick complete an evening postmortem in 10–15 minutes?
- Does the report feel useful when pasted into another chat?
- Does the UI feel JRPG-inspired without becoming hard to read?
- Does it work well on Android screen sizes?


---

# Definition of Done

A vertical slice is not done until it passes this checklist.

## Product done

- The slice produces the promised user outcome.
- The user can understand what changed without reading code.
- The UI has empty, loading, success, and error states where relevant.
- Missing data is handled honestly.
- No future-slice features were added accidentally.

## Technical done

- TypeScript passes.
- Tests for the acceptance criteria exist.
- Existing tests still pass.
- Data contracts are typed and validated where input crosses a boundary.
- Code is modular enough for the next slice.
- No API keys or secrets are exposed.

## AI done, when applicable

- AI calls happen server-side.
- AI context is compact and relevant.
- AI actions require confirmation before mutation.
- Tool payloads are validated on the backend.
- AI behavior boundaries are tested or documented.

## Health data done, when applicable

- Health data is treated as sensitive.
- The app does not provide diagnosis or treatment advice.
- Imported data is clearly labeled by source.
- Invalid imported data fails safely.

## Portfolio done, when applicable

- Demo data is clearly labeled.
- Real and demo data are separable.
- Screens are readable on desktop and Android.
- Screenshots/reports communicate the project clearly.


---

# V00 — Walking Skeleton

## User outcome
Patrick can open the app locally, see the LifeQuest OS shell, navigate between core routes, and confirm the project has a testable foundation.

## Why this slice exists
This prevents Codex from building features into an unstable scaffold. It establishes app structure, routing, typing, test commands, and PWA basics before product logic.

## Scope
Build a minimal Next.js + TypeScript PWA scaffold.

Required routes:

- `/` — redirects or links to `/dashboard`.
- `/dashboard` — command center placeholder.
- `/tasks` — quest log placeholder.
- `/standup/morning` — morning stand-up placeholder.
- `/standup/evening` — evening postmortem placeholder.
- `/metrics` — metrics placeholder.
- `/journal` — journal placeholder.
- `/reports` — reports placeholder.
- `/settings` — settings placeholder.

Required baseline features:

- App layout with navigation.
- Responsive mobile-first layout.
- PWA manifest.
- Basic metadata.
- Environment variable pattern for backend-only OpenAI keys.
- Test harness.
- Type check script.

## Non-goals
Do not implement real task CRUD, AI calls, metric logging, reports, voice, or health import yet.

## UI contract
The app should visually establish the JRPG direction without overdesign:

- App title: `LifeQuest OS`.
- Navigation labels may use JRPG flavor: Dashboard, Quest Log, Morning Stand-Up, Evening Postmortem, Metrics, Journal, Reports, Settings.
- Dark theme preferred.
- Body text must remain readable.

## Data contract
No real persisted data yet.

Create placeholder TypeScript types in a shared domain folder for future slices:

- `Task`
- `DailyPlan`
- `MetricEntry`
- `JournalEntry`
- `DailyReport`

Fields can be skeletal but should include `id`, `createdAt`, and `updatedAt` where appropriate.

## API contract
No product API required yet.

Create `/api/health` returning:

```json
{ "ok": true, "app": "LifeQuest OS" }
```

## Acceptance criteria

### AC1: App loads
Given the app is running locally, when Patrick visits `/dashboard`, then he sees the LifeQuest OS shell and navigation.

### AC2: Core routes exist
Given Patrick clicks each nav item, when the route loads, then the app shows the correct placeholder page without errors.

### AC3: API health route works
Given the app is running, when `/api/health` is requested, then it returns HTTP 200 and `{ ok: true }`.

### AC4: PWA basics exist
Given the built app, when the manifest is inspected, then it includes name, short name, start URL, display mode, and icons or icon placeholders.

### AC5: Secret hygiene baseline
Given the repository is searched, when frontend code is inspected, then no OpenAI API key or permanent credential appears in client-side code.

## Test criteria

### Unit/type tests
- TypeScript type check passes.
- Domain placeholder types compile.

### Integration tests
- `/api/health` returns expected payload.

### E2E tests
- `/dashboard` loads.
- Navigation routes load.

### Security tests
- Assert no `NEXT_PUBLIC_OPENAI_API_KEY` pattern is used.
- Environment variable docs say server-side key only.

## Codex prompt

```txt
Implement V00 Walking Skeleton only.

Build a Next.js + TypeScript PWA scaffold for LifeQuest OS with the listed routes, navigation, placeholder domain types, /api/health, and test harness.
Do not implement real tasks, AI, reports, metrics, voice, or health import yet.
Add tests for route loading and /api/health.
Keep all code typed and minimal.
Summarize the diff and how to run tests.
```

## Review checklist
- Does the app run?
- Does every route exist?
- Is the PWA shell mobile-friendly?
- Are no secrets exposed?
- Did Codex avoid building future features?


---

# V01 — Quest Log: Create and Complete Task

## User outcome
Patrick can create a task, view it in the Quest Log, mark it complete, and archive it.

## Why this slice exists
Tasks are the backbone of the morning stand-up, evening postmortem, AI tool calls, and daily reports. This slice creates the first real domain object end-to-end.

## Scope
Implement task CRUD with local persistence.

Minimum supported actions:

- Create task.
- Edit task title/description/priority/tag/due date/planned date.
- Mark task complete.
- Reopen task.
- Archive task.
- Display active, completed, and archived tasks.

## Non-goals
Do not build AI task tools, DailyPlan, stand-up flow, reminders, recurring tasks, or complex filters yet.

## UI contract
Route: `/tasks`

Required UI:

- Task creation form.
- Task list grouped by:
  - Active Quests.
  - Cleared Quests.
  - Archived.
- Empty state: “No quests yet. Add one small win.”
- Priority display: low, medium, high.
- Tags: health, work, content, social, admin, learning.

## Data contract

```ts
type TaskStatus = 'todo' | 'done' | 'archived';
type TaskPriority = 'low' | 'medium' | 'high';
type TaskTag = 'health' | 'work' | 'content' | 'social' | 'admin' | 'learning';

type Task = {
  id: string;
  title: string;
  description?: string;
  status: TaskStatus;
  priority: TaskPriority;
  tags: TaskTag[];
  dueDate?: string;        // ISO date
  plannedForDate?: string; // ISO date
  completedAt?: string;    // ISO timestamp
  archivedAt?: string;     // ISO timestamp
  createdAt: string;
  updatedAt: string;
};
```

Persistence can be local storage or a simple local database abstraction, but it should be behind a small repository/service layer so future DB migration is easier.

## API contract
No backend API required unless the chosen architecture already uses server actions. Keep API minimal.

## Acceptance criteria

### AC1: Create task
Given Patrick is on `/tasks`, when he enters a title and submits the form, then the new task appears under Active Quests.

### AC2: Validate title
Given Patrick submits an empty task title, when the form is submitted, then the task is not created and a clear validation message appears.

### AC3: Complete task
Given an active task exists, when Patrick marks it complete, then it moves to Cleared Quests and receives a `completedAt` timestamp.

### AC4: Reopen task
Given a completed task exists, when Patrick reopens it, then it moves back to Active Quests and `completedAt` is cleared.

### AC5: Archive task
Given a task exists, when Patrick archives it, then it moves to Archived and receives an `archivedAt` timestamp.

### AC6: Persist task
Given Patrick creates a task, when he refreshes the page, then the task is still visible.

## Test criteria

### Unit tests
- Task schema accepts valid tasks.
- Task schema rejects empty titles.
- Completing a task sets `status='done'` and `completedAt`.
- Reopening clears `completedAt`.
- Archiving sets `status='archived'` and `archivedAt`.

### Component tests
- Create form validates title.
- Task list groups by status.

### E2E tests
- Create → refresh → complete → reopen → archive.

## Codex prompt

```txt
Implement V01 Quest Log Task CRUD only.

Use the Task data contract from the slice.
Create a typed task repository/service with local persistence.
Build /tasks with create, edit, complete, reopen, and archive behavior.
Add unit/component/e2e tests for the listed acceptance criteria.
Do not implement stand-up, AI, reports, reminders, metrics, or recurring tasks.
```

## Review checklist
- Can you create a real task quickly?
- Does task state survive refresh?
- Is the UI simple enough for daily use?
- Did Codex avoid adding AI or planning features too early?


---

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


---

# V03 — Morning Stand-Up Manual

## User outcome
Patrick can run a simple morning stand-up without AI: review open tasks, choose a Main Quest and Side Quests, add a new task, and save a DailyPlan.

## Why this slice exists
This creates the product’s core daily planning loop before AI. The AI should later enhance this flow, not invent it from scratch.

## Scope
Implement a guided `/standup/morning` flow.

Steps:

1. Show active tasks.
2. Let Patrick choose one Main Quest.
3. Let Patrick choose up to three Side Quests.
4. Let Patrick add quick tasks during planning.
5. Let Patrick write a short intention for the day.
6. Save a `DailyPlan` for today.
7. Return to dashboard showing the selected plan.

## Non-goals
No AI prioritization yet. No voice. No reminders. No calendar integration.

## UI contract
Route: `/standup/morning`

Required states:

- No open tasks: offer quick task creation.
- Existing plan today: show “Edit today’s plan” instead of creating duplicate silently.
- Saved confirmation: “Today’s quest plan is locked in.”

## Data contract

```ts
type DailyPlan = {
  id: string;
  date: string; // ISO date
  mainQuestTaskId?: string;
  sideQuestTaskIds: string[];
  intention?: string;
  status: 'planned' | 'closed';
  createdAt: string;
  updatedAt: string;
};
```

Rules:

- One active DailyPlan per date.
- Main Quest must reference an active non-archived task.
- Side Quests must reference active non-archived tasks.
- Main Quest cannot also be a Side Quest.
- Maximum 3 Side Quests.

## API contract
No backend API required unless using server actions.

## Acceptance criteria

### AC1: Start stand-up
Given active tasks exist, when Patrick opens `/standup/morning`, then he sees those tasks as planning options.

### AC2: Create quick task
Given Patrick thinks of a new item during stand-up, when he creates a quick task, then it appears as a selectable planning option.

### AC3: Save plan
Given Patrick selects one Main Quest, optional Side Quests, and an intention, when he saves, then a DailyPlan is stored for today.

### AC4: Enforce limits
Given Patrick tries to select more than three Side Quests, when he selects a fourth, then the UI blocks it or shows a clear message.

### AC5: Dashboard reflects plan
Given a DailyPlan exists for today, when Patrick returns to `/dashboard`, then the dashboard shows the Main Quest and Side Quests.

### AC6: Edit not duplicate
Given today already has a DailyPlan, when Patrick opens morning stand-up, then the existing plan is editable instead of creating a duplicate.

## Test criteria

### Unit tests
- DailyPlan schema validation.
- Main Quest and Side Quest cannot overlap.
- Side Quest maximum enforced.
- One plan per date upsert behavior.

### Component tests
- Plan selection UI shows active tasks.
- Quick task creation updates selectable list.

### E2E tests
- Create tasks → run morning stand-up → save plan → dashboard shows plan.
- Reopen stand-up → edit plan → no duplicate plan exists.

## Codex prompt

```txt
Implement V03 Morning Stand-Up Manual only.

Create a DailyPlan data model and repository.
Build /standup/morning as a guided manual planning flow using existing tasks.
Allow quick task creation, Main Quest selection, up to three Side Quests, and daily intention.
Update /dashboard to show today's saved DailyPlan.
Add tests for plan validation, save/edit behavior, and dashboard reflection.
Do not implement AI, voice, metrics, reports, or reminders.
```

## Review checklist
- Can you create a day plan in under 2 minutes?
- Does the dashboard reflect the plan clearly?
- Is the flow useful without AI?


---

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


---

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


---

# V06 — Journal and Lesson Capture

## User outcome
Patrick can capture reflections and lessons learned, which later feed reports and LinkedIn content generation.

## Why this slice exists
The app is not just a tracker. It is a narrative engine. The journal gives the AI and report generator raw material for meaningful summaries.

## Scope
Implement journal entry creation and browsing.

Entry types:

- Morning intention.
- Evening reflection.
- Lesson learned.
- Freeform note.

Prompt examples:

- What did I learn today?
- What felt harder than expected?
- What pattern do I want to notice?
- What would make tomorrow easier?
- What might be worth sharing publicly?

## Non-goals
No AI rewriting yet. No LinkedIn post generation. No advanced rich text editor.

## UI contract
Route: `/journal`

Required UI:

- New journal entry form.
- Entry type selector.
- Date selector.
- Prompt picker.
- Recent entries list.
- Edit/delete entry.

## Data contract

```ts
type JournalEntryType = 'morning_intention' | 'evening_reflection' | 'lesson' | 'freeform';

type JournalEntry = {
  id: string;
  date: string; // ISO date
  type: JournalEntryType;
  prompt?: string;
  content: string;
  linkedDailyPlanId?: string;
  linkedPostmortemId?: string;
  source: 'manual' | 'ai_assisted' | 'voice_transcript' | 'demo';
  createdAt: string;
  updatedAt: string;
};
```

Validation:

- Content is required.
- Content max length can be generous, for example 10,000 characters.

## API contract
No backend API required unless using server actions.

## Acceptance criteria

### AC1: Create entry
Given Patrick opens `/journal`, when he writes content and saves, then the entry appears in recent entries.

### AC2: Prompt picker
Given Patrick wants help reflecting, when he selects a prompt, then the prompt is attached to the entry.

### AC3: Edit entry
Given a journal entry exists, when Patrick edits and saves it, then the updated content persists.

### AC4: Delete entry
Given a journal entry exists, when Patrick deletes it, then it is removed after confirmation.

### AC5: Date filtering
Given entries exist across dates, when Patrick selects a date, then entries for that date are easy to find or highlighted.

## Test criteria

### Unit tests
- Journal schema validates content and type.
- Date filtering helper returns correct entries.

### Component tests
- Prompt picker attaches prompt.
- Edit/delete flows work.

### E2E tests
- Create → edit → refresh → delete journal entry.

## Codex prompt

```txt
Implement V06 Journal and Lesson Capture only.

Build JournalEntry model, validation, local persistence, /journal UI, prompt picker, recent entries list, edit, and delete.
Add unit/component/e2e tests for create/edit/delete and prompt behavior.
Do not implement AI rewriting, LinkedIn generation, voice transcripts, or reports yet.
```

## Review checklist
- Can Patrick capture a useful lesson in under one minute?
- Are prompts helpful without being cheesy?
- Is this data ready for report generation?


---

# V07 — Markdown Daily Report Export

## User outcome
Patrick can generate and download a Markdown report for a selected date using actual tasks, metrics, plans, postmortem, and journal entries.

## Why this slice exists
This is a key differentiator: the app creates portable narrative output for LinkedIn/content workflows. This also gives the AI future context in a clean format.

## Scope
Implement deterministic report generation without AI.

Report sections:

1. Title/date.
2. Daily quest summary.
3. Tasks planned.
4. Tasks completed.
5. Metrics snapshot.
6. Wins.
7. Friction.
8. Lessons learned.
9. Tomorrow follow-ups.
10. LinkedIn source material.
11. Missing data notes.

## Non-goals
No AI-written report yet. No direct LinkedIn posting. No PDF export.

## UI contract
Route: `/reports`

Required UI:

- Date selector.
- Generate preview button.
- Markdown preview.
- Download `.md` button.
- Copy to clipboard button.

File name:

```txt
lifequest-report-YYYY-MM-DD.md
```

## Data contract
Report generator reads:

- `Task[]`
- `DailyPlan | undefined`
- `EveningPostmortem | undefined`
- `MetricEntry[]`
- `JournalEntry[]`

Create:

```ts
type DailyReport = {
  id: string;
  date: string;
  markdownContent: string;
  generatedBy: 'deterministic' | 'ai';
  createdAt: string;
  updatedAt: string;
};
```

Rules:

- Do not invent missing data.
- If a section lacks data, explicitly say `Not logged` or `No entry captured`.
- Markdown should be valid and readable outside the app.

## API contract
No backend API required unless using server actions.

## Acceptance criteria

### AC1: Generate report
Given today has tasks, metrics, and reflections, when Patrick generates a report, then the preview includes those actual values.

### AC2: Missing data honesty
Given some data is missing, when a report is generated, then missing sections are labeled honestly instead of invented.

### AC3: Download report
Given a report preview exists, when Patrick clicks download, then a `.md` file downloads with the correct date-based filename.

### AC4: Copy report
Given a report preview exists, when Patrick clicks copy, then the Markdown content is copied to clipboard.

### AC5: Report persistence
Given Patrick generates a report, when he returns to the report date, then the latest generated report can be viewed or regenerated.

## Test criteria

### Unit tests
- Report generator includes known task values.
- Report generator includes known metric values.
- Report generator labels missing data.
- Filename generator returns correct filename.

### Component tests
- Preview renders generated Markdown.
- Copy button calls clipboard API.

### E2E tests
- Create task + metric + journal + postmortem → generate report → verify preview contains values.
- Download button creates `.md` artifact or triggers expected browser behavior.

## Codex prompt

```txt
Implement V07 Markdown Daily Report Export only.

Create DailyReport model and deterministic report generator that reads existing tasks, DailyPlan, EveningPostmortem, MetricEntry, and JournalEntry records.
Build /reports with date selector, preview, copy, and download .md behavior.
Add unit/component/e2e tests for correct data inclusion, missing-data honesty, and filename behavior.
Do not implement AI-written reports, LinkedIn posting, PDF export, or charts.
```

## Review checklist
- Would this Markdown be useful if pasted into another ChatGPT conversation?
- Does it avoid inventing data?
- Does the output support LinkedIn storytelling?


---

# V08 — AI Chat with Read-Only App Context

## User outcome
Patrick can chat with the AI coach from inside the app, and the AI can reference recent tasks, metrics, plans, journal entries, and reports, but cannot mutate data yet.

## Why this slice exists
This adds the cloud AI safely. Read-only mode proves backend key handling, context packing, and UX before tool calls can change data.

## Scope
Implement text AI chat with a secure backend endpoint.

Capabilities:

- User sends message.
- Backend builds compact context from stored app data.
- Backend calls OpenAI API server-side.
- AI replies in LifeQuest coach style.
- Chat transcript displays in UI.

## Non-goals
No AI tool calls. No data mutation. No voice. No streaming required unless easy.

## UI contract
Route: `/coach` or embedded `AICoachPanel` from dashboard.

Required UI:

- Message list.
- Input field.
- Send button.
- Loading state.
- Error state.
- Context mode label: `Read-only coach mode`.

## Data contract
Create compact context builder:

```ts
type AIAppContext = {
  today: string;
  openTasks: Task[];
  todaysPlan?: DailyPlan;
  recentMetrics: MetricEntry[];
  recentJournalEntries: JournalEntry[];
  latestReport?: DailyReport;
};
```

Context rules:

- Keep context compact.
- Prefer recent data.
- Do not include archived tasks unless relevant.
- Do not include secrets.

## API contract
Endpoint: `POST /api/ai/chat`

Request:

```ts
type AIChatRequest = {
  message: string;
  mode: 'general' | 'morning' | 'evening' | 'report';
};
```

Response:

```ts
type AIChatResponse = {
  message: string;
  mode: string;
  usedContext: {
    openTaskCount: number;
    recentMetricCount: number;
    recentJournalEntryCount: number;
  };
};
```

Security:

- OpenAI API key only on server.
- No permanent key in frontend.
- Validate request body.
- Return safe error messages.

## Acceptance criteria

### AC1: Send chat message
Given Patrick opens the AI coach panel, when he sends a message, then the AI response appears in the message list.

### AC2: Uses app context
Given open tasks and metrics exist, when Patrick asks “What should I focus on today?”, then the backend sends compact app context to the AI.

### AC3: Read-only boundary
Given the AI suggests task changes, when it replies, then no tasks are created, edited, or completed by this slice.

### AC4: Secure key handling
Given the frontend bundle is inspected, then the OpenAI API key is not present.

### AC5: Error handling
Given the backend call fails, when Patrick sends a message, then the UI shows a useful error without exposing secrets.

## Test criteria

### Unit tests
- Request schema validation.
- Context builder includes correct recent records.
- Context builder excludes archived tasks by default.

### Integration tests
- `/api/ai/chat` rejects invalid requests.
- `/api/ai/chat` calls mocked OpenAI client with server-side context.
- Error path returns safe message.

### E2E tests
- User sends message and sees mocked AI response.

### Security tests
- No OpenAI key in client code.
- No secret returned in error response.

## Codex prompt

```txt
Implement V08 AI Chat with Read-Only App Context only.

Create /api/ai/chat with validated request body, server-side OpenAI call, compact app context builder, and safe errors.
Build a text AI coach UI with read-only mode label.
Use mocks in tests so tests do not call the real OpenAI API.
Do not implement AI tool calls, data mutation, voice, streaming, or reports beyond reading existing data.
```

## Review checklist
- Can the AI answer using your app data?
- Are keys safe?
- Did Codex avoid tool calls and mutation?


---

# V09 — AI Task Tools with Confirmation

## User outcome
Patrick can ask the AI to create, update, complete, defer, or archive tasks, but changes are shown as proposed actions that require confirmation.

## Why this slice exists
This is where the AI becomes useful without becoming dangerous. Confirmation keeps the user in control and makes tool behavior testable.

## Scope
Add backend-validated task tool proposals and a frontend confirmation queue.

Supported AI task actions:

- Create task.
- Update task.
- Complete task.
- Defer task.
- Archive task.

## Non-goals
No metric/journal tools yet. No autonomous batch changes without review. No voice.

## UI contract
In AI coach UI:

- AI response can include proposed actions.
- Proposed actions render as cards.
- Each card has Confirm and Reject.
- Confirm executes the change.
- Reject dismisses it.
- Applied changes are logged in transcript.

## Data contract

```ts
type AIToolProposalStatus = 'pending' | 'confirmed' | 'rejected' | 'applied' | 'failed';

type AIToolProposal = {
  id: string;
  toolName: 'create_task' | 'update_task' | 'complete_task' | 'defer_task' | 'archive_task';
  summary: string;
  payload: unknown;
  status: AIToolProposalStatus;
  createdAt: string;
  updatedAt: string;
};
```

Each payload must be validated with Zod or equivalent.

## API contract

### `POST /api/ai/chat`
Can return:

```ts
type AIChatResponse = {
  message: string;
  proposals?: AIToolProposal[];
};
```

### `POST /api/ai/tools/confirm`
Request:

```ts
type ConfirmToolRequest = {
  proposalId: string;
};
```

Response:

```ts
type ConfirmToolResponse = {
  ok: boolean;
  appliedChangeSummary: string;
};
```

Implementation note: if proposals are not persisted yet, the confirm endpoint can receive the signed/validated proposal payload. Prefer persisted proposals if feasible.

## Acceptance criteria

### AC1: AI proposes task creation
Given Patrick says “Add a task to walk on the treadmill tomorrow,” when the AI responds, then it shows a proposed create-task action instead of silently creating it.

### AC2: Confirm applies change
Given a pending create-task proposal exists, when Patrick confirms it, then the task is created and appears in Quest Log.

### AC3: Reject does not apply
Given a pending proposal exists, when Patrick rejects it, then no task mutation occurs.

### AC4: Complete task proposal
Given an existing task exists, when Patrick asks the AI to mark it done, then a complete-task proposal appears and confirmation completes the task.

### AC5: Payload validation
Given a malformed tool payload is returned or submitted, then the backend rejects it safely and does not mutate data.

### AC6: Audit trail
Given a proposal is confirmed or rejected, then the transcript or proposal state clearly shows the outcome.

## Test criteria

### Unit tests
- Tool payload schemas validate valid payloads.
- Tool payload schemas reject invalid payloads.
- Applying each task tool updates task state correctly.

### Integration tests
- Mock AI response containing proposal creates pending proposal.
- Confirm endpoint applies validated proposal.
- Malformed proposal fails safely.

### E2E tests
- Ask AI to create task → confirm → task appears.
- Ask AI to create task → reject → task does not appear.
- Ask AI to complete task → confirm → task moves to done.

### Security tests
- Tool confirmation cannot execute arbitrary tool names.
- Client cannot bypass validation with malformed payload.

## Codex prompt

```txt
Implement V09 AI Task Tools with Confirmation only.

Extend AI chat so the backend can return validated task tool proposals.
Render pending proposals in the AI coach UI with Confirm and Reject.
Implement confirmation handling that applies only validated task mutations.
Add tests for create/update/complete/defer/archive proposals, reject behavior, malformed payloads, and audit trail.
Do not implement metric tools, journal tools, autonomous mutations, voice, or morning/evening agent flows yet.
```

## Review checklist
- Does the AI ask permission before changing data?
- Are proposed actions understandable?
- Can malformed payloads mutate anything? They should not.


---

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


---

# V11 — AI Morning Stand-Up Agent

## User outcome
Patrick can start a morning stand-up with the AI, discuss priorities, create or update tasks through confirmations, and end with a saved DailyPlan.

## Why this slice exists
This is the product’s signature interaction: a daily planning call with an AI partner.

## Scope
Enhance `/standup/morning` with AI-assisted planning.

AI responsibilities:

- Review open tasks and recent metrics.
- Ask focused planning questions.
- Suggest a realistic Main Quest and Side Quests.
- Propose new tasks if Patrick mentions them.
- Propose a DailyPlan.
- Save DailyPlan only after Patrick confirms.

## Non-goals
No voice yet. No autonomous plan save. No complex calendar integration.

## UI contract
Route: `/standup/morning`

Modes:

- Manual mode still available.
- AI-assisted mode.

AI stand-up UI:

- Chat panel.
- Open task context panel.
- Proposed plan card.
- Confirm Plan button.
- Edit manually option.

## Data contract
Add proposal tool:

```ts
type ProposeDailyPlanPayload = {
  date: string;
  mainQuestTaskId?: string;
  sideQuestTaskIds: string[];
  intention?: string;
  rationale?: string;
};
```

On confirmation, upsert `DailyPlan`.

Rules:

- Main Quest and Side Quests must reference valid active tasks.
- No duplicate plan for the date.
- Max 3 Side Quests.
- Plan proposal must include rationale.

## API contract
Reuse AI chat endpoint with mode `morning`.

Extend tool proposal confirmation with:

- `propose_daily_plan`

## Acceptance criteria

### AC1: Start AI stand-up
Given Patrick opens `/standup/morning` and selects AI-assisted mode, when the session starts, then the AI greets him with a concise planning prompt and references today’s context.

### AC2: Suggest priorities
Given open tasks and recent metrics exist, when Patrick asks what to prioritize, then the AI suggests a Main Quest and up to three Side Quests with rationale.

### AC3: Propose new tasks
Given Patrick mentions new work during the stand-up, when the AI identifies it as actionable, then it proposes task creation cards for confirmation.

### AC4: Confirm plan
Given the AI proposes a DailyPlan, when Patrick confirms it, then today’s DailyPlan is saved and dashboard updates.

### AC5: Reject/edit plan
Given the AI proposes a DailyPlan, when Patrick rejects it or edits manually, then no unwanted plan mutation occurs.

### AC6: Overload control
Given Patrick has too many tasks, when AI suggests the day plan, then it limits the day to one Main Quest and up to three Side Quests.

## Test criteria

### Unit tests
- DailyPlan proposal validation.
- Invalid task IDs rejected.
- Max Side Quest count enforced.

### Integration tests
- Mock AI propose_daily_plan → confirm → DailyPlan saved.
- Mock AI create_task during stand-up → confirm → task appears in selectable tasks.

### E2E tests
- AI stand-up mock session → confirm plan → dashboard shows plan.
- Reject proposed plan → dashboard remains unchanged.

### AI behavior tests
- AI does not suggest more than one Main Quest.
- AI uses recent low energy/sleep context to recommend realistic workload.
- AI asks no more than one or two questions before proposing a plan when enough context exists.

## Codex prompt

```txt
Implement V11 AI Morning Stand-Up Agent only.

Enhance /standup/morning with AI-assisted mode using the existing read-only chat and confirmed tool proposal system.
Add propose_daily_plan proposal with validation and confirmation.
Allow AI to propose task creation through existing task tools during the session.
Save DailyPlan only after explicit confirmation.
Add tests for proposal validation, confirmation, rejection, dashboard update, and AI overload-control behavior.
Do not implement voice, evening AI, reminders, or calendar integration.
```

## Review checklist
- Does this feel like a useful daily stand-up?
- Does the AI keep the plan realistic?
- Can you steer/reject without fighting the app?


---

# V12 — AI Evening Postmortem and Report

## User outcome
Patrick can have an AI-guided end-of-day postmortem that closes tasks, captures lessons, proposes follow-up tasks, and generates a Markdown report.

## Why this slice exists
This completes the AI daily loop and creates the report artifact Patrick wants for LinkedIn/content workflows.

## Scope
Enhance `/standup/evening` with AI-assisted postmortem.

AI responsibilities:

- Review today’s DailyPlan and task status.
- Ask reflective questions.
- Propose task completions/deferments.
- Propose journal entries/lessons.
- Propose follow-up tasks for tomorrow.
- Generate or improve Markdown report.

## Non-goals
No direct LinkedIn posting. No voice. No calendar scheduling. No medical advice.

## UI contract
Route: `/standup/evening`

AI postmortem UI:

- Chat panel.
- Today’s plan/task panel.
- Proposed changes queue.
- Reflection capture panel.
- Generate report button.
- Report preview after generation.

## Data contract
Add or reuse proposals:

- `complete_task`
- `defer_task`
- `create_task`
- `create_journal_entry`
- `generate_daily_report`

Report generation payload:

```ts
type GenerateDailyReportPayload = {
  date: string;
  style: 'deterministic' | 'ai_assisted';
  includeLinkedInSourceMaterial: boolean;
};
```

AI-assisted reports must still not invent data. They can interpret and summarize stored facts.

## API contract
Reuse AI chat endpoint with mode `evening` and report tool confirmation.

## Acceptance criteria

### AC1: Start AI postmortem
Given today has a DailyPlan, when Patrick starts AI-assisted evening mode, then the AI references the plan and asks a focused reflection question.

### AC2: Close tasks through confirmation
Given Patrick says he completed a planned task, when the AI proposes completion, then Patrick must confirm before the task is marked done.

### AC3: Capture lessons
Given Patrick shares what he learned, when the AI proposes a journal entry, then confirmation stores it as a lesson or evening reflection.

### AC4: Create tomorrow follow-up
Given Patrick mentions a next step, when the AI proposes a follow-up task, then confirmation creates an active task planned for tomorrow if appropriate.

### AC5: Generate report
Given postmortem data exists, when Patrick generates an AI-assisted report, then the report preview includes tasks, metrics, reflections, lessons, and LinkedIn source material.

### AC6: Missing data honesty
Given some data is absent, when AI generates a report, then it explicitly notes missing data and does not invent values.

### AC7: Close DailyPlan
Given the postmortem is completed and confirmed, then today’s DailyPlan can be marked closed.

## Test criteria

### Unit tests
- Report payload validation.
- AI-assisted report builder includes stored facts and missing-data labels.
- Tomorrow date helper works.

### Integration tests
- Mock AI complete_task proposal → confirm → task done.
- Mock AI journal proposal → confirm → journal entry stored.
- Mock AI generate_daily_report → confirm → report stored.

### E2E tests
- AI evening session mock → confirm completion + lesson + report → report preview includes values.

### AI behavior tests
- AI asks reflective questions instead of generic praise.
- AI does not invent metrics.
- AI proposes realistic tomorrow follow-ups.
- AI does not diagnose health conditions.

## Codex prompt

```txt
Implement V12 AI Evening Postmortem and Report only.

Enhance /standup/evening with AI-assisted mode using existing confirmed tool proposals.
Allow AI to propose task outcomes, journal entries, tomorrow follow-up tasks, and AI-assisted report generation.
All mutations require confirmation.
Reports must use stored data and label missing data honestly.
Add tests for confirmations, report generation, missing-data honesty, and AI behavior constraints.
Do not implement voice, LinkedIn posting, calendar integration, or medical advice.
```

## Review checklist
- Does the session produce a useful report?
- Does the AI ask better questions than a static form?
- Are all mutations confirmed?
- Is missing data handled honestly?


---

# V13 — Android PWA Install and Offline Shell

## User outcome
Patrick can install the app on Android/desktop and still load the shell when offline.

## Why this slice exists
The app is intended to be a PWA-first Android/desktop experience. This slice makes it feel like a real app instead of just a webpage.

## Scope
Improve PWA installability and offline behavior.

Features:

- Valid manifest.
- App icons.
- Service worker or framework-supported PWA plugin.
- Offline fallback shell.
- Basic caching for app shell/static assets.
- Install instructions page or settings hint.

## Non-goals
No offline AI. No offline sync conflict resolution. No native Android wrapper.

## UI contract
Route: `/settings` or `/install`

Required UI:

- Shows PWA install readiness.
- Explains Android install steps.
- Shows offline support boundaries.

## Data contract
No new domain data required.

## API contract
No product API required.

## Acceptance criteria

### AC1: Manifest valid
Given the built app, when manifest is inspected, then it has name, short name, start URL, scope, display, icons, and theme color.

### AC2: Installable
Given Patrick opens the app in a compatible browser, then the app meets installability requirements.

### AC3: Offline shell
Given the app shell was loaded once, when Patrick goes offline and reloads, then a useful offline shell appears.

### AC4: Offline boundary
Given Patrick is offline, when he tries to use AI chat, then the app explains AI requires network access.

### AC5: No cache secrets
Given service worker cache is inspected, then it does not cache secrets or sensitive API responses unintentionally.

## Test criteria

### Unit tests
- Offline boundary component renders correctly.

### E2E/manual tests
- Lighthouse/PWA check passes for installability basics.
- Offline reload shows shell.
- AI unavailable message appears offline.

### Security tests
- Service worker does not cache `/api/ai/*` responses.
- No secrets are stored in static assets.

## Codex prompt

```txt
Implement V13 Android PWA Install and Offline Shell only.

Improve manifest/icons/service worker/offline fallback so the app is installable and loads a safe offline shell.
Add install guidance in settings.
Make AI routes show a clear network-required boundary when offline.
Do not implement offline AI, native Android wrapper, or advanced sync.
```

## Review checklist
- Can you install it on Android?
- Does reload offline avoid a blank screen?
- Are AI and sensitive API responses excluded from cache?


---

# V14 — Voice Session Alpha

## User outcome
Patrick can see a voice-mode entry point for morning/evening sessions, start a Realtime-compatible session architecture, and capture transcript/handoff data when available.

## Why this slice exists
Voice is important, but it should be layered on top of stable text flows and tools. This slice creates the architecture without derailing the MVP.

## Scope
Build voice-mode foundation.

Features:

- Backend endpoint to create ephemeral Realtime session credentials.
- Frontend voice session UI shell.
- Start/stop controls.
- Transcript panel or placeholder.
- Handoff path from transcript to existing AI text/tool flow.
- Clear error states for unsupported browser/microphone permissions.

## Non-goals
No requirement to perfect full voice UX yet. No native Android microphone bridge. No always-listening mode.

## UI contract
Routes or embedded modes:

- Morning stand-up: Voice Mode button.
- Evening postmortem: Voice Mode button.

Required UI:

- Start Voice Session.
- Stop Voice Session.
- Mic permission status.
- Transcript/status area.
- Fallback to text mode.

## Data contract

```ts
type VoiceSession = {
  id: string;
  mode: 'morning' | 'evening' | 'general';
  status: 'idle' | 'connecting' | 'active' | 'ended' | 'failed';
  transcript?: string;
  startedAt?: string;
  endedAt?: string;
};
```

Do not store raw audio in MVP unless explicitly needed later.

## API contract
Endpoint: `POST /api/realtime/session`

Request:

```ts
type CreateRealtimeSessionRequest = {
  mode: 'morning' | 'evening' | 'general';
};
```

Response:

```ts
type CreateRealtimeSessionResponse = {
  clientSecret: string;
  expiresAt?: string;
  mode: string;
};
```

Security:

- Browser receives only ephemeral credential.
- Permanent OpenAI key stays server-side.
- Validate mode.

## Acceptance criteria

### AC1: Voice entry point visible
Given Patrick opens morning or evening flow, when voice mode is available, then he sees a Voice Mode button.

### AC2: Create session server-side
Given Patrick starts voice mode, when the frontend requests `/api/realtime/session`, then the backend returns an ephemeral client credential or a mocked test credential in test mode.

### AC3: Permanent key not exposed
Given frontend code and network responses are inspected, then the permanent OpenAI API key is never exposed.

### AC4: Permission handling
Given microphone permission is denied, when Patrick starts voice mode, then the UI shows a clear fallback to text mode.

### AC5: Transcript handoff
Given a transcript is captured or mocked, when Patrick ends the session, then the transcript can be handed into the existing text AI flow for tool proposals.

## Test criteria

### Unit tests
- VoiceSession state reducer.
- Realtime session request validation.

### Integration tests
- `/api/realtime/session` rejects invalid mode.
- `/api/realtime/session` returns mocked ephemeral credential in test environment.
- Does not return permanent API key.

### E2E tests
- Start voice mode with mocked session → active state shown → stop → transcript handoff available.
- Permission denied path shows fallback.

### Security tests
- No permanent key in client response.
- Realtime credentials are not stored in local storage.

## Codex prompt

```txt
Implement V14 Voice Session Alpha only.

Add /api/realtime/session for ephemeral Realtime credentials, a voice-mode UI shell in morning/evening flows, voice session state handling, permission/error states, and transcript handoff to existing text AI flow.
Use mocks in tests.
Do not expose permanent OpenAI keys.
Do not implement always-listening mode, native Android wrapper, or raw audio storage.
```

## Review checklist
- Is voice architecture secure?
- Does text fallback remain strong?
- Can transcript handoff reuse existing confirmed tool flow?


---

# V15 — Health Import Alpha

## User outcome
Patrick can import exported Samsung Health/Galaxy Watch-style data files into the app and normalize supported records into MetricEntry data.

## Why this slice exists
Wearable sync is valuable, but direct native integration is a larger project. Manual export/import validates the data pipeline first.

## Scope
Implement health import page and parser foundation.

Supported MVP import concepts:

- Steps.
- Sleep duration.
- Heart rate summary, if available.
- Workout summary.
- Blood pressure, if available.

The parser should be tolerant because exported file names/fields may vary.

## Non-goals
No direct Samsung Health API integration. No Health Connect native bridge. No medical advice. No perfect parser for every export format.

## UI contract
Route: `/health-import`

Required UI:

- Explanation of manual import flow.
- File upload control.
- Dry-run preview before import.
- Field mapping preview.
- Confirm import button.
- Import result summary.
- Error handling for invalid files.

## Data contract

```ts
type HealthImportBatch = {
  id: string;
  source: 'samsung_export' | 'health_connect' | 'demo';
  fileNames: string[];
  status: 'previewed' | 'imported' | 'failed';
  recordsParsed: number;
  recordsImported: number;
  errors: string[];
  createdAt: string;
};

type ImportedHealthRecord = {
  id: string;
  batchId: string;
  sourceType: 'steps' | 'sleep' | 'heart_rate' | 'workout' | 'blood_pressure' | 'unknown';
  startTime?: string;
  endTime?: string;
  value?: number;
  unit?: string;
  raw: unknown;
};
```

Normalized supported records should create or update `MetricEntry` records with `source='samsung_export'`.

## API contract
Can be client-side parser for MVP, but prefer pure parser functions that can later move server-side.

## Acceptance criteria

### AC1: Upload file
Given Patrick opens `/health-import`, when he uploads a supported CSV/JSON-like file, then the app shows a dry-run preview.

### AC2: Preview before import
Given parsed records exist, when the preview is shown, then Patrick can see record type, date, value, and target metric mapping before importing.

### AC3: Confirm import
Given Patrick confirms import, then normalized supported records are stored as MetricEntry records with source `samsung_export`.

### AC4: Invalid file handling
Given Patrick uploads an invalid file, then the app shows a clear error and does not create metric records.

### AC5: Duplicate protection
Given the same import file is uploaded twice, then the app avoids obvious duplicate records or warns before duplicating.

### AC6: Dashboard update
Given imported steps/sleep records exist, when Patrick opens dashboard, then the latest metric snapshot can include imported values.

## Test criteria

### Unit tests
- Parser handles valid steps fixture.
- Parser handles valid sleep fixture.
- Parser handles invalid/missing-header fixture.
- Normalizer maps supported records to MetricEntry.
- Duplicate detection works for same source/time/value.

### Component tests
- Upload preview renders parsed records.
- Confirm import stores records.
- Invalid file shows error.

### E2E tests
- Upload fixture → preview → confirm → metrics page shows imported entries.

### Safety tests
- Imported health data does not trigger diagnosis or medical treatment advice.
- Raw uploaded data is not sent to AI unless user explicitly uses AI context flow.

## Codex prompt

```txt
Implement V15 Health Import Alpha only.

Build /health-import with manual file upload, dry-run preview, parser fixtures, confirmation, and normalization into MetricEntry records with source samsung_export.
Add duplicate detection and invalid-file handling.
Use pure parser functions with unit tests.
Do not implement direct Samsung Health API, Health Connect native bridge, medical advice, or automatic sync.
```

## Review checklist
- Can the parser handle sample files without crashing?
- Is import preview understandable before data is saved?
- Are imported records clearly labeled by source?


---

# V16 — Portfolio Demo and JRPG Polish

## User outcome
Patrick can show the app publicly with a polished JRPG-inspired UI, demo data mode, screenshots, and Markdown reports that communicate both product thinking and technical skill.

## Why this slice exists
This project is also a portfolio/LinkedIn artifact. Polish should come after the core loop works, not before.

## Scope
Add final demo/presentation polish.

Features:

- Demo mode with clearly labeled fake data.
- Better visual hierarchy.
- JRPG-inspired panels, quest cards, status meters.
- Charts for progress where data exists.
- Screenshot-friendly dashboard and report preview.
- Architecture summary page or README for portfolio.

## Non-goals
No fake data mixed with real data. No direct LinkedIn posting. No overdesigned animation that hurts usability.

## UI contract
Demo mode:

- Toggle in settings.
- Clear badge: `Demo Data`.
- Seed sample tasks, metrics, journal entries, and reports.
- Ability to reset demo data.

JRPG visual rules:

- Fun, but readable.
- Retro-inspired, not childish.
- Modern accessibility standards.
- Mobile-first.

## Data contract
Demo data must use `source='demo'` where applicable and must never overwrite real data without explicit reset/confirmation.

## API contract
No new product API required unless using a seed endpoint in development only.

## Acceptance criteria

### AC1: Demo mode seed
Given Patrick enables demo mode, when demo data is seeded, then dashboard, tasks, metrics, journal, and reports show populated sample content.

### AC2: Demo label
Given demo data is visible, then the UI clearly labels it as demo data.

### AC3: Reset demo data
Given demo data exists, when Patrick resets demo mode, then demo records are removed without deleting real records.

### AC4: Screenshot-ready dashboard
Given dashboard has data, when viewed on desktop and mobile, then it is visually coherent enough for portfolio screenshots.

### AC5: Report presentation
Given a Markdown report exists, when previewed, then it is readable and easy to screenshot or copy.

### AC6: Accessibility baseline
Given key screens are inspected, then text contrast, keyboard access, and labels are acceptable.

## Test criteria

### Unit tests
- Demo data seed marks records as demo.
- Reset removes only demo records.

### Component tests
- Demo badge renders when demo data is active.
- Dashboard handles populated demo state.

### E2E tests
- Enable demo mode → dashboard populated → reset demo → real data preserved.

### Accessibility/manual tests
- Keyboard navigation through primary screens.
- Contrast/readability check.
- Mobile viewport smoke test.

## Codex prompt

```txt
Implement V16 Portfolio Demo and JRPG Polish only.

Add demo mode with clearly labeled source='demo' records, reset behavior that preserves real data, improved JRPG-inspired UI styling, screenshot-ready dashboard/report presentation, and accessibility baseline checks.
Add tests for demo seed/reset and demo labeling.
Do not mix demo data with real data silently, do not implement LinkedIn posting, and do not add excessive animation.
```

## Review checklist
- Would you post screenshots of this on LinkedIn?
- Is demo data impossible to confuse with real data?
- Is it still usable on Android?
