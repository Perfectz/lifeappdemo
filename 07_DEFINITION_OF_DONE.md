# Definition of Done

A vertical slice is not done until it passes this checklist.

## Product done

- The slice produces the promised user outcome.
- The user can understand what changed without reading code.
- The UI has empty, loading, success, and error states where relevant.
- Missing data is handled honestly.
- No future-slice features were added accidentally.

## Technical done

- TypeScript passes.
- Tests for the acceptance criteria exist.
- Existing tests still pass.
- Data contracts are typed and validated where input crosses a boundary.
- Code is modular enough for the next slice.
- No API keys or secrets are exposed.

## AI done, when applicable

- AI calls happen server-side.
- AI context is compact and relevant.
- AI actions require confirmation before mutation.
- Tool payloads are validated on the backend.
- AI behavior boundaries are tested or documented.

## Health data done, when applicable

- Health data is treated as sensitive.
- The app does not provide diagnosis or treatment advice.
- Imported data is clearly labeled by source.
- Invalid imported data fails safely.

## Portfolio done, when applicable

- Demo data is clearly labeled.
- Real and demo data are separable.
- Screens are readable on desktop and Android.
- Screenshots/reports communicate the project clearly.
