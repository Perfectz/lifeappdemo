# Architecture

## Tech stack

- **Framework:** Next.js 15 (App Router) — `next: ^15.3.0`. Pages and API routes live under `src/app/`.
- **UI:** React 19 (`react`/`react-dom: ^19.0.0`). Client components are marked `"use client"`.
- **Language:** TypeScript (`^5.8.3`, `tsc --noEmit` for type checking). Path alias `@/*` → `src/*`.
- **Cloud (optional):** `@supabase/supabase-js` for auth + a single-row JSON snapshot per user.
- **Push (optional, dormant):** `web-push` (feature-flagged off by default).
- **Tests:** Vitest (`^3.1.2`) with `@testing-library/react` + `@testing-library/jest-dom` on `jsdom`. E2E with `@playwright/test`.
- **Lint:** ESLint 9 (flat config) + `typescript-eslint` + `eslint-config-next`.
- **Fonts/theme:** Google fonts (Pixelify Sans, VT323) for the JRPG look; menu theme applied pre-paint via an inline script in the root layout.

Scripts (from `package.json`): `dev`, `build`, `start`, `typecheck`, `lint`, `test` (`vitest run`), `test:e2e` (`playwright test`), plus `build:pages` for static export.

## Local-first storage model

The **browser is the source of truth.** Data is read instantly and works offline. Three storage tiers:

### 1. localStorage repositories (`src/data/`)
Most entities are stored as JSON arrays in `localStorage` behind a generic factory, `createLocalRepository<T>(storage, storageKey, guard, migrations?)` ([`src/data/createLocalRepository.ts`](../src/data/createLocalRepository.ts)):

- Every repository has a versioned key like `lifequest.tasks.v1`, `lifequest.metricEntries.v1`, `lifequest.workouts.v1`, `lifequest.journalEntries.v1`, `lifequest.notes.v1`, `lifequest.dailyPlans.v1`, `lifequest.dailyReports.v1`, `lifequest.wiki.v1`, `lifequest.healthGoals.v1`.
- `load()` filters stored records through the entity's **type guard**, warns (does not silently drop) on unreadable records, and runs **lazy migrations** from legacy keys when the current key is empty.
- `save()` writes JSON and then dispatches a `lifequest:data-changed` (`dataChangedEventName`) window `CustomEvent`. The native `storage` event only fires cross-tab, so this custom event is how **same-tab** consumers (hero card, nav status, cloud sync) stay live after a write.
- Write failures don't throw into UI handlers; they call `emitStorageError`, which logs and dispatches `lifequest:storage-error` so a single listener (`StorageErrorToast`) can show a banner (e.g. quota-exceeded guidance).
- `getLifeQuestStorageUsage` reports per-key byte usage for the settings/storage UI.

### 2. IndexedDB for progress photos (`src/data/progressPhotoStore.ts`)
Progress photos are large and intimate, so they are stored **only** in IndexedDB (DB `lifequest-media`, store `progressPhotos`), never in localStorage (too small) and **never in the cloud snapshot or git**. Changes dispatch a `lifequest:progress-photos-changed` event. The AI sees these images only when the user explicitly requests an assessment.

### 3. Supabase cloud snapshot (optional) (`src/client/cloudSync.ts`)
When Supabase is configured and the user is signed in, the full local snapshot (the export envelope produced by `exportAllData`) is pushed to a single per-user row in the `user_data` table (`{ user_id, data jsonb, updated_at }`), protected by Row Level Security. See [`supabase/schema.sql`](../supabase/schema.sql).

- **Reads stay local;** the cloud is backup/sync, not the runtime store.
- **Conflict model: last-write-wins with optimistic concurrency.** Pushes are debounced; before overwriting, the client checks the remote `updated_at` against the last synced timestamp. If the cloud moved (another device wrote), it does **not** clobber — it stashes a timestamped local backup, then pulls the remote. Worst case is "remote wins, local recoverable."
- Auth is **email/password** (with magic-link and Google OAuth also wired). `AuthGate` requires a session before rendering the app *only when Supabase is configured*; otherwise it falls through to local-only. Public URL + anon key are safe in the browser (RLS enforces per-user access); the service_role key is never used client-side.

## Domain layer conventions (`src/domain/`)

The domain is framework-free, pure TypeScript. Each entity module follows a consistent pattern:

1. **Constant arrays** of allowed values (e.g. `taskPriorities`, `taskTags`, `journalEntryTypes`, `progressPhotoAngles`).
2. An **`Input` type** describing the user-supplied shape (e.g. `TaskInput`).
3. A **`ValidationResult` union**: `{ ok: true; value: T } | { ok: false; message: string }`.
4. **`validate*` / `create*` / `is*` functions:** `validateXInput` normalizes/validates; `createX` validates then builds a full entity; `isX` is the type guard used by repositories.
5. **IDs via `globalThis.crypto?.randomUUID?.()`** (with a deterministic fallback for non-crypto environments). Timestamps are ISO strings; most entities extend `TimestampedEntity` (`id`, `createdAt`, `updatedAt`).

`src/domain/types.ts` holds the shared entity types; `src/domain/index.ts` re-exports public types. AI context assembly lives in `src/domain/aiContext.ts`, and confirmation-gated tool proposals in `src/domain/aiTaskTools.ts`.

## Server AI layer (`src/server/ai/`)

Server-only modules that talk to OpenAI. All are injectable for tests (each exposes a `set*ForTests` hook) and all throw `AINotConfiguredError` when `OPENAI_API_KEY` is missing, so routes can return a graceful 503.

- **`openaiClient.ts`** — the read-only coach chat (`completeReadOnlyCoachChat`). Defines:
  - `OpenAIRequestError` (carries upstream HTTP status) and `buildOpenAIError`, which translates 401/429/400/404 into actionable messages ("check OPENAI_API_KEY", "rate limit/quota", "model id/parameters may be unsupported").
  - `chatCompletionBody(...)` — the shared request builder that serves **both** model families: reasoning models (gpt-5 / o-series) get `max_completion_tokens` + `reasoning_effort` and reject custom `temperature`; classic chat models get `temperature`. Family is detected by `isReasoningModel` in config.
- **`briefClient.ts`** — turns the deterministic daily-brief facts into one short spoken-style coach sentence.
- **`visionClient.ts`** — extracts loggable data from a single image (capture flow), returning strict-JSON proposals.
- **`progressClient.ts`** — assesses 1–3 progress photos against the user's goal, returning a strict-JSON assessment.
- **`realtimeClient.ts`** — mints an ephemeral client secret for the realtime voice session (`createRealtimeClientSecret`); returns a mock secret in tests/dev when no key is set.
- **`rateLimiter.ts`** — a simple in-memory fixed-window limiter (default 20 requests / 60s per key, per server instance) used by every AI route.

API routes ([`src/app/api/`](../src/app/api/)): `ai/chat`, `ai/brief`, `ai/vision`, `ai/progress`, `ai/tools/confirm`, `realtime/session`, plus `health` and `cron/reminders`. AI routes set `maxDuration = 60` to fit the in-code OpenAI timeout.

## Configuration (`src/config/`)

- **`ai.ts`** — the **single source of truth for model ids**, intentionally in code (a product decision, not a secret): `COACH_MODEL` (default `gpt-5.5`, override via `OPENAI_COACH_MODEL`) and `REALTIME_VOICE_MODEL` (default `gpt-realtime-2`, override via `OPENAI_REALTIME_MODEL`). `isReasoningModel(model)` distinguishes reasoning vs classic chat models. The **only secret is `OPENAI_API_KEY`**.
- **`fitness.ts`** — the five-day strength split (with Free Weight / Machine / Kettlebell variants, schemes, form instructions, and form-video links), cardio options, and martial-arts options.
- **`navigation.ts`** — grouped nav (Today / Reflect / Tools + Settings footer) and the flat list used by the command palette and tests.
- **`features.ts`** — feature flags (push notifications, off by default).
- **`site.ts`** — `basePath` / `withBasePath` for sub-path deployments.
- **`sprites.ts`** — JRPG sprite/asset config.

## PWA service worker

[`public/sw.js`](../public/sw.js) precaches the app shell and static assets (offline page, manifest, icons) under a versioned cache (`lifequest-vNN`). It **never caches** `/api/`, `/_next/`, or any `openai` / `realtime` / `ai` request. Registered by `PWAServiceWorkerRegister`; the root layout wires the manifest, icons, theme color, and `viewport-fit=cover` for notched devices/installed PWAs.

## Directory map (`src/`)

```
src/
  app/                     Next.js App Router
    layout.tsx             Root layout: fonts, metadata, AuthGate, AppShell, SW register
    page.tsx               Entry
    dashboard/  fitness/  tasks/  standup/morning/    "Today" routes
    metrics/  vitals/  progress/  health-import/      "Reflect" routes
    profile/  journal/  notes/  trends/
    reports/  coach/  capture/  settings/  offline/   "Tools" + misc routes
    api/
      ai/{chat,brief,vision,progress,tools/confirm}/route.ts
      realtime/session/route.ts
      health/route.ts
      cron/reminders/route.ts
  components/              React UI (Dashboard, DailyFitness, Vitals, ProgressPhotos,
                          AICoachPanel, VoiceAgent, AuthGate, AppShell, MorningStandup, ...)
  domain/                 Pure TS domain: types, validation, business logic
                          (tasks, metrics, vitals, biometrics, workouts, dailyFitness,
                           dailyBrief, journal, notes, dailyPlans, reports, goals,
                           progressPhotos, progressAssessment, visionUpdates,
                           personalWiki, aiContext, aiTaskTools, voiceSessions,
                           healthImport, insights, demoData, ...)
  data/                   Storage: createLocalRepository + per-entity repositories,
                          progressPhotoStore (IndexedDB), wiki/healthGoals repos
  server/ai/              Server-only OpenAI clients + rate limiter
  client/                 Browser-side glue: cloudSync, voiceAgent, voiceTools,
                          dataBackup, pushClient, clientIds
  config/                 ai, fitness, navigation, features, site, sprites
  lib/supabase/client.ts  Browser Supabase client (null when unconfigured)
```
