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
