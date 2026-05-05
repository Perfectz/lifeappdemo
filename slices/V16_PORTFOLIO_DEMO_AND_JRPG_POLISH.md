# V16 — Portfolio Demo and JRPG Polish

## User outcome
Patrick can show the app publicly with a polished JRPG-inspired UI, demo data mode, screenshots, and Markdown reports that communicate both product thinking and technical skill.

## Why this slice exists
This project is also a portfolio/LinkedIn artifact. Polish should come after the core loop works, not before.

## Scope
Add final demo/presentation polish.

Features:

- Demo mode with clearly labeled fake data.
- Better visual hierarchy.
- JRPG-inspired panels, quest cards, status meters.
- Charts for progress where data exists.
- Screenshot-friendly dashboard and report preview.
- Architecture summary page or README for portfolio.

## Non-goals
No fake data mixed with real data. No direct LinkedIn posting. No overdesigned animation that hurts usability.

## UI contract
Demo mode:

- Toggle in settings.
- Clear badge: `Demo Data`.
- Seed sample tasks, metrics, journal entries, and reports.
- Ability to reset demo data.

JRPG visual rules:

- Fun, but readable.
- Retro-inspired, not childish.
- Modern accessibility standards.
- Mobile-first.

## Data contract
Demo data must use `source='demo'` where applicable and must never overwrite real data without explicit reset/confirmation.

## API contract
No new product API required unless using a seed endpoint in development only.

## Acceptance criteria

### AC1: Demo mode seed
Given Patrick enables demo mode, when demo data is seeded, then dashboard, tasks, metrics, journal, and reports show populated sample content.

### AC2: Demo label
Given demo data is visible, then the UI clearly labels it as demo data.

### AC3: Reset demo data
Given demo data exists, when Patrick resets demo mode, then demo records are removed without deleting real records.

### AC4: Screenshot-ready dashboard
Given dashboard has data, when viewed on desktop and mobile, then it is visually coherent enough for portfolio screenshots.

### AC5: Report presentation
Given a Markdown report exists, when previewed, then it is readable and easy to screenshot or copy.

### AC6: Accessibility baseline
Given key screens are inspected, then text contrast, keyboard access, and labels are acceptable.

## Test criteria

### Unit tests
- Demo data seed marks records as demo.
- Reset removes only demo records.

### Component tests
- Demo badge renders when demo data is active.
- Dashboard handles populated demo state.

### E2E tests
- Enable demo mode → dashboard populated → reset demo → real data preserved.

### Accessibility/manual tests
- Keyboard navigation through primary screens.
- Contrast/readability check.
- Mobile viewport smoke test.

## Codex prompt

```txt
Implement V16 Portfolio Demo and JRPG Polish only.

Add demo mode with clearly labeled source='demo' records, reset behavior that preserves real data, improved JRPG-inspired UI styling, screenshot-ready dashboard/report presentation, and accessibility baseline checks.
Add tests for demo seed/reset and demo labeling.
Do not mix demo data with real data silently, do not implement LinkedIn posting, and do not add excessive animation.
```

## Review checklist
- Would you post screenshots of this on LinkedIn?
- Is demo data impossible to confuse with real data?
- Is it still usable on Android?
