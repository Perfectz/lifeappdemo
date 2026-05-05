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
