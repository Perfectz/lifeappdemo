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
