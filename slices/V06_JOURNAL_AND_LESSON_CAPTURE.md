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
