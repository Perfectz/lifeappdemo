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
