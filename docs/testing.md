# Testing system

LifeQuest OS is verified by four layers. The single command that runs the core
gate is:

```bash
npm run verify        # typecheck → lint → unit/component tests → production build
```

If `verify` passes, the app compiles, type-checks, lints clean, all unit +
component tests pass, and a production build succeeds.

## Layers

| Layer | Command | What it covers | Where |
|-------|---------|----------------|-------|
| **Types** | `npm run typecheck` | `tsc --noEmit` across the whole codebase | — |
| **Lint** | `npm run lint` | ESLint (Next + TS rules) | — |
| **Unit + component** | `npm run test` | Pure domain logic + React components (jsdom) | `tests/**/*.test.ts(x)` |
| **End-to-end** | `npm run test:e2e` | Full user flows in a real browser (Playwright) | `e2e/**/*.spec.ts` |

Extra commands:

- `npm run test:watch` — vitest in watch mode while developing.
- `npm run test:coverage` — unit/component tests with a V8 coverage report
  (text summary + HTML in `./coverage`, gitignored).

## What the unit/component suite tests

The Vitest suite is the workhorse and runs in milliseconds with no browser:

- **Domain logic** (`src/domain`): vitals + alerts, biometrics classification,
  nutrition (macros, net carbs), meal-photo estimate parsing, food-search
  normalization, levels/XP, character stats, bosses, alignment, transformation,
  health & nutrition goals, agent memory, personal wiki, AI context assembly,
  daily brief, reports, tasks, journal, metrics, workouts, fitness.
- **Client logic** (`src/client`): voice tools dispatcher (incl. memory
  read/write), AI API client, data backup/export, sound settings.
- **Components** (`src/components`): coach chat, nutrition diary, vitals,
  fitness, morning stand-up, dashboard, and more — rendered in jsdom with
  mocked network.
- **Server route guards** + **security baseline** (no public secrets, health
  guidance stays non-diagnostic, service worker never caches AI/secret routes).

Server modules that call OpenAI / Open Food Facts are injectable
(`set*ForTests`) so tests never hit the network. Browser-only APIs absent from
jsdom (IndexedDB, camera/`BarcodeDetector`, `BarcodeDetector`) are exercised
through their pure domain layers; the thin IO wrappers are covered by e2e.

## CI

`.github/workflows/ci.yml` has two jobs on every push and pull request:

- **verify** — `typecheck → lint → test:coverage → build` (uploads coverage).
- **e2e** — installs Playwright + Chromium and runs the smoke suite.

Both must pass. (`deploy-pages.yml` separately runs the unit checks before deploying.)

## End-to-end (Playwright)

`e2e/smoke.spec.ts` is a resilient smoke suite that boots the dev server and
verifies every core screen loads (dashboard, vitals, nutrition, fitness,
character, progress, coach, morning) and that the core daily flows persist (log
vitals, log a food). It runs on `chromium` + `mobile-chrome`. Run locally with
`npm run test:e2e`.

The login gate (`AuthGate`) is bypassed for tests via `NEXT_PUBLIC_E2E=1`, which
the Playwright `webServer` sets — it is never enabled in production builds, and
the real protection is Supabase RLS, not the client gate.

The older per-feature specs were removed once they fell behind major feature
changes; rebuild targeted specs on top of the smoke suite as flows stabilize.
