# LifeQuest OS — Knowledge Base

LifeQuest OS is a local-first, JRPG-themed personal **health, fitness, and life-coaching** Progressive Web App (PWA). It blends daily vitals tracking, a fixed three-session fitness routine, quests/tasks, journaling, and progress photos with an AI coach that grounds its guidance in the user's own data and self-profile. The guiding idea is **identity transformation, not just tracking**: every screen nudges the user toward the healthier, more disciplined future version of themselves they are trying to become. The deterministic app works fully offline and without any API keys; AI and cloud sync are optional layers that degrade gracefully when their keys are absent.

This `docs/` folder is the official, AI-agent-readable knowledge base for the project. Start here.

## Contents

| Doc | What it covers |
| --- | --- |
| [overview.md](./overview.md) | What the app is, who it's for, and the core philosophy. |
| [goals-and-background.md](./goals-and-background.md) | Product vision, the four pillars, and the role of the AI coach. |
| [features.md](./features.md) | Structured feature list grouped by area, with routes. |
| [architecture.md](./architecture.md) | Tech stack, local-first storage model, domain/AI/config layers, PWA, and a directory map. |
| [data-model.md](./data-model.md) | Key domain entities, their fields, and where each is stored (cloud vs device-local). |
| [ai-integration.md](./ai-integration.md) | How chat, vision, voice, and the personal wiki work; models, rate limiting, env vars, graceful degradation. |
| [conventions.md](./conventions.md) | Coding conventions, validation/repository patterns, test setup, verification commands, and contribution rules. |

## Quick orientation for a new agent

- **Stack:** Next.js 15 (App Router) + React 19 + TypeScript. Tests: Vitest + Testing Library (jsdom). E2E: Playwright. Lint: ESLint (flat config).
- **Source of truth for data:** the browser. `localStorage` repositories + an IndexedDB store for photos. Supabase is an *optional* cloud backup/sync layer.
- **Source of truth for AI model ids:** [`src/config/ai.ts`](../src/config/ai.ts) (code, not secrets).
- **The only required secret for AI:** `OPENAI_API_KEY`.
- **Privacy:** the repo is public. No personal data, real names, or specific health readings live in source — see [conventions.md](./conventions.md).
