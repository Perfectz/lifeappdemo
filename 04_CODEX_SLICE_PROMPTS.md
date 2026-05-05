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
