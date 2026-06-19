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

`.github/workflows/ci.yml` runs `typecheck → lint → test:coverage → build` on
every push and pull request, and uploads the coverage report as an artifact.
(`deploy-pages.yml` separately runs the same checks before deploying.)

## End-to-end (Playwright)

`e2e/` holds browser specs (`chromium` + `mobile-chrome` projects) that boot the
dev server and drive real flows. Run locally with `npm run test:e2e`. These are
not yet wired into CI and lag behind recent feature changes — they need a
refresh pass before being made a required gate.
