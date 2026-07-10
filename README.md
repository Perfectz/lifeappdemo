# LifeQuest OS

LifeQuest OS is a **Next.js + React personal operating system** prototype with a JRPG-inspired UI, local-first data storage, daily planning loops, and AI-assisted workflows.

## Features

- Adaptive dashboard for today’s health actions, scheduled training, overdue quests, and goals.
- Goal hierarchy that links long-term direction to concrete quests.
- Advanced Quest Log with natural-language capture, recurrence, checklists, difficulty, and goal links.
- Morning standup and evening postmortem workflows.
- Adaptive nutrition, scheduled training/recovery, vitals, water, supplements, and weekly review.
- Metrics, journal capture, trends, character progression, and report export.
- LifeQuest Agent with dedicated coaching, personal-assistant, planning, and review modes.
- Context harness grounded in goals, quests, health data, notes, and durable memories, with approval-gated actions.
- Universal Capture inbox for quickly saving quests, notes, and reflections.
- Optional Gmail assistant connection for on-demand inbox digests and reviewable drafts; LifeQuest never sends mail automatically.
- Realtime voice coaching and hands-free capture foundations.
- PWA install + offline shell support.

## Tech Stack

- Next.js App Router
- React 19
- TypeScript
- Vitest + Playwright

## Project Structure

- `src/app` — routed pages and API routes
- `src/components` — reusable UI components
- `src/domain` — domain types and core logic
- `src/data` — local repository modules
- `tests` and `e2e` — unit/component and end-to-end coverage

## Screenshots

> Note: In this execution environment, browser binaries were unavailable for automated page captures, so these screenshots use bundled project art assets.

### Character + Theme Assets

![Patrick Sprite Sheet](public/assets/sprites/patrick-sprite-sheet.png)

![AI Advisor Emotion Sheet](public/assets/sprites/ai-advisor-emotion-sheet.png)

### Navigation Icon Set

![LifeQuest Navigation Icon Sheet](public/assets/sprites/lifequest-nav-icon-sheet.png)

## Getting Started

```bash
npm install
npm run dev
```

App runs at `http://127.0.0.1:3000`.

## Useful Scripts

```bash
npm run lint
npm run typecheck
npm run test
npm run test:e2e
```

## Notes

- Demo mode guidance is available in `PORTFOLIO_DEMO_README.md`.
- Health/AI features are supportive workflow tools and not medical advice.
