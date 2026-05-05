# V13 — Android PWA Install and Offline Shell

## User outcome
Patrick can install the app on Android/desktop and still load the shell when offline.

## Why this slice exists
The app is intended to be a PWA-first Android/desktop experience. This slice makes it feel like a real app instead of just a webpage.

## Scope
Improve PWA installability and offline behavior.

Features:

- Valid manifest.
- App icons.
- Service worker or framework-supported PWA plugin.
- Offline fallback shell.
- Basic caching for app shell/static assets.
- Install instructions page or settings hint.

## Non-goals
No offline AI. No offline sync conflict resolution. No native Android wrapper.

## UI contract
Route: `/settings` or `/install`

Required UI:

- Shows PWA install readiness.
- Explains Android install steps.
- Shows offline support boundaries.

## Data contract
No new domain data required.

## API contract
No product API required.

## Acceptance criteria

### AC1: Manifest valid
Given the built app, when manifest is inspected, then it has name, short name, start URL, scope, display, icons, and theme color.

### AC2: Installable
Given Patrick opens the app in a compatible browser, then the app meets installability requirements.

### AC3: Offline shell
Given the app shell was loaded once, when Patrick goes offline and reloads, then a useful offline shell appears.

### AC4: Offline boundary
Given Patrick is offline, when he tries to use AI chat, then the app explains AI requires network access.

### AC5: No cache secrets
Given service worker cache is inspected, then it does not cache secrets or sensitive API responses unintentionally.

## Test criteria

### Unit tests
- Offline boundary component renders correctly.

### E2E/manual tests
- Lighthouse/PWA check passes for installability basics.
- Offline reload shows shell.
- AI unavailable message appears offline.

### Security tests
- Service worker does not cache `/api/ai/*` responses.
- No secrets are stored in static assets.

## Codex prompt

```txt
Implement V13 Android PWA Install and Offline Shell only.

Improve manifest/icons/service worker/offline fallback so the app is installable and loads a safe offline shell.
Add install guidance in settings.
Make AI routes show a clear network-required boundary when offline.
Do not implement offline AI, native Android wrapper, or advanced sync.
```

## Review checklist
- Can you install it on Android?
- Does reload offline avoid a blank screen?
- Are AI and sensitive API responses excluded from cache?
