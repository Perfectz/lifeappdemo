# V00 — Walking Skeleton

## User outcome
Patrick can open the app locally, see the LifeQuest OS shell, navigate between core routes, and confirm the project has a testable foundation.

## Why this slice exists
This prevents Codex from building features into an unstable scaffold. It establishes app structure, routing, typing, test commands, and PWA basics before product logic.

## Scope
Build a minimal Next.js + TypeScript PWA scaffold.

Required routes:

- `/` — redirects or links to `/dashboard`.
- `/dashboard` — command center placeholder.
- `/tasks` — quest log placeholder.
- `/standup/morning` — morning stand-up placeholder.
- `/standup/evening` — evening postmortem placeholder.
- `/metrics` — metrics placeholder.
- `/journal` — journal placeholder.
- `/reports` — reports placeholder.
- `/settings` — settings placeholder.

Required baseline features:

- App layout with navigation.
- Responsive mobile-first layout.
- PWA manifest.
- Basic metadata.
- Environment variable pattern for backend-only OpenAI keys.
- Test harness.
- Type check script.

## Non-goals
Do not implement real task CRUD, AI calls, metric logging, reports, voice, or health import yet.

## UI contract
The app should visually establish the JRPG direction without overdesign:

- App title: `LifeQuest OS`.
- Navigation labels may use JRPG flavor: Dashboard, Quest Log, Morning Stand-Up, Evening Postmortem, Metrics, Journal, Reports, Settings.
- Dark theme preferred.
- Body text must remain readable.

## Data contract
No real persisted data yet.

Create placeholder TypeScript types in a shared domain folder for future slices:

- `Task`
- `DailyPlan`
- `MetricEntry`
- `JournalEntry`
- `DailyReport`

Fields can be skeletal but should include `id`, `createdAt`, and `updatedAt` where appropriate.

## API contract
No product API required yet.

Create `/api/health` returning:

```json
{ "ok": true, "app": "LifeQuest OS" }
```

## Acceptance criteria

### AC1: App loads
Given the app is running locally, when Patrick visits `/dashboard`, then he sees the LifeQuest OS shell and navigation.

### AC2: Core routes exist
Given Patrick clicks each nav item, when the route loads, then the app shows the correct placeholder page without errors.

### AC3: API health route works
Given the app is running, when `/api/health` is requested, then it returns HTTP 200 and `{ ok: true }`.

### AC4: PWA basics exist
Given the built app, when the manifest is inspected, then it includes name, short name, start URL, display mode, and icons or icon placeholders.

### AC5: Secret hygiene baseline
Given the repository is searched, when frontend code is inspected, then no OpenAI API key or permanent credential appears in client-side code.

## Test criteria

### Unit/type tests
- TypeScript type check passes.
- Domain placeholder types compile.

### Integration tests
- `/api/health` returns expected payload.

### E2E tests
- `/dashboard` loads.
- Navigation routes load.

### Security tests
- Assert no `NEXT_PUBLIC_OPENAI_API_KEY` pattern is used.
- Environment variable docs say server-side key only.

## Codex prompt

```txt
Implement V00 Walking Skeleton only.

Build a Next.js + TypeScript PWA scaffold for LifeQuest OS with the listed routes, navigation, placeholder domain types, /api/health, and test harness.
Do not implement real tasks, AI, reports, metrics, voice, or health import yet.
Add tests for route loading and /api/health.
Keep all code typed and minimal.
Summarize the diff and how to run tests.
```

## Review checklist
- Does the app run?
- Does every route exist?
- Is the PWA shell mobile-friendly?
- Are no secrets exposed?
- Did Codex avoid building future features?
