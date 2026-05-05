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
