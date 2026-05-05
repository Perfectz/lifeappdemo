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
