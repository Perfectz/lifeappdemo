# Conventions & Contributing

This doc captures the patterns and rules to follow when changing LifeQuest OS. Match the existing style — the codebase is consistent on purpose.

## Domain validation pattern

Every domain entity module ([`src/domain/`](../src/domain/)) follows the same shape. When adding or changing an entity, replicate it:

1. **Constant arrays** for allowed values, e.g. `export const taskTags: TaskTag[] = [...]`. These are the single source of truth for enums (and are reused by AI tool schemas and tests).
2. **`Input` type** for user-supplied data (e.g. `TaskInput`), separate from the persisted entity type in `types.ts`.
3. **`ValidationResult` union:** `{ ok: true; value: T } | { ok: false; message: string }`. Never throw for ordinary validation failures — return `{ ok: false, message }`.
4. **`validate*` / `create*` / `is*` trio:**
   - `validateXInput(input)` normalizes (trim, drop empties) and validates, returning the union.
   - `createX(input, now?)` validates then constructs the full entity. IDs via `globalThis.crypto?.randomUUID?.()` with a deterministic string fallback; timestamps as ISO strings; entities usually extend `TimestampedEntity`.
   - `isX(value)` is the runtime type guard used by repositories' `load()`.
5. Keep the domain **pure and framework-free** — no React, no `localStorage`, no `fetch`. Side effects belong in `data/`, `client/`, `server/`, or components.

## Repository pattern

- Persist collections via `createLocalRepository<T>(storage, storageKey, guard, migrations?)` ([`src/data/createLocalRepository.ts`](../src/data/createLocalRepository.ts)).
- Use a **versioned key** (`lifequest.<entity>.vN`) and export it (e.g. `taskStorageKey`) for tests and tooling.
- To evolve a schema without losing history, add a `RepositoryMigration` from the old key rather than mutating in place.
- After any write, `save()` dispatches `lifequest:data-changed`; consumers that need live updates in the same tab listen for it (this is also what triggers cloud sync). Don't write to `localStorage` directly for synced entities — go through a repository so the event fires and the guard runs.
- Surface write failures with `emitStorageError` (it dispatches `lifequest:storage-error`); never let a write throw into a UI event handler.
- **Progress photos are the exception:** they use the IndexedDB store ([`src/data/progressPhotoStore.ts`](../src/data/progressPhotoStore.ts)), are device-local, and must never be added to the cloud snapshot.

## Test conventions

- **Runner:** Vitest on **jsdom** ([`vitest.config.ts`](../vitest.config.ts)). Tests live in `tests/` as `*.test.ts` / `*.test.tsx`. The `@` alias resolves to `src/`.
- **Setup:** [`tests/setup.ts`](../tests/setup.ts) registers `@testing-library/jest-dom/vitest` and cleans up the DOM after each test.
- **Component tests** use `@testing-library/react` (`render`, `screen`, user interaction) — see e.g. `tests/dashboard-components.test.tsx`.
- **Domain/logic tests** are plain unit tests over the pure functions (e.g. `tests/tasks.test.ts`, `tests/daily-brief.test.ts`).
- **AI is tested without network calls.** Inject behavior via the `set*ForTests` hooks the server clients expose (`setOpenAIChatCompletionForTests`, `setVisionExtractionForTests`, `setProgressAssessmentForTests`, `setBriefGeneratorForTests`, `setRealtimeClientSecretForTests`). The realtime route also honors `LIFEQUEST_MOCK_REALTIME_SESSION=1`.
- There is a dedicated `tests/security.test.ts` — keep it green; it guards the no-PII / no-secrets posture.
- Coverage is broad: there is a test file per domain module, route, and major component. New behavior should come with tests.

## Verification commands

Run these before considering a change done (they mirror the `package.json` scripts):

```
npm run typecheck     # tsc --noEmit
npm run lint          # eslint .
npx vitest run        # unit + component tests (or: npm test)
npm run build         # next build — catches App Router / build-time issues
npm run test:e2e      # playwright (when relevant)
```

> Note: another process may be editing the code concurrently in some sessions. If asked not to run long-running commands (build/test), don't — but the above is the standard local gate otherwise.

## Hard rules

1. **AI features must degrade gracefully without a key.** Any new AI capability must: throw `AINotConfiguredError` server-side when `OPENAI_API_KEY` is missing, have its route return a friendly 503, and leave the deterministic app fully usable. Never put an AI call on a critical path.
2. **Never commit PII or health data — the repo is public.** No real names, no specific health readings (blood pressure, weight, A1C, glucose numbers), no medications, no partner/people names, no addresses. The user's private profile lives only in their locally stored About Me wiki. Describe the product and its concepts generically. `tests/security.test.ts` exists to enforce this — extend it if you add new surfaces.
3. **Model ids live in code, not env.** Default model ids belong in [`src/config/ai.ts`](../src/config/ai.ts) (a product decision, not a secret). The only secret is `OPENAI_API_KEY`. Env vars (`OPENAI_COACH_MODEL`, `OPENAI_REALTIME_MODEL`) exist only as optional overrides.
4. **The browser is the source of truth.** Cloud sync is backup/sync, never the runtime read path. Keep reads local and instant.
5. **AI proposes, the user confirms.** Don't let AI (chat or vision) directly mutate persisted data without the confirmation gate. (The voice agent is the deliberate, narrowly-scoped exception — additive/safe actions only, no delete/archive.)
6. **Secrets stay server-side.** `OPENAI_API_KEY` and Supabase service_role key must never reach the browser bundle. Only the public Supabase URL + anon key (RLS-protected) are shipped client-side.

## Git / commit conventions

- Work on a branch off `main` for changes; only commit or push when asked.
- End commit messages with the co-author trailer:

  ```
  Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
  ```

- End PR bodies with the generated-with note when applicable.
