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
