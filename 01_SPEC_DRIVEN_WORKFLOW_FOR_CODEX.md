# Spec-Driven Workflow for Codex

Use this workflow for every vertical slice.

## 1. Slice spec

Every slice should define:

- User outcome.
- Scope.
- Non-goals.
- UI contract.
- Data contract.
- API contract, if applicable.
- Acceptance criteria.
- Test criteria.
- Review checklist.

## 2. Implementation discipline

Codex should:

- Implement the smallest version that satisfies the slice.
- Keep code typed with TypeScript.
- Avoid fake data unless explicitly labeled as demo data.
- Avoid hidden global state.
- Avoid exposing secrets in frontend code.
- Keep AI calls server-side.
- Validate API/tool payloads.
- Add tests before or during implementation.

## 3. Review gate

Before accepting a slice, verify:

- Acceptance criteria are met.
- Tests pass.
- No unrelated features were added.
- Data shape stayed compatible with future slices.
- User-visible wording matches the JRPG/life-coach tone without hurting usability.

## 4. Recommended test stack

Use whatever Codex installs or the project already has, but a practical default is:

- Unit tests: Vitest.
- Component tests: React Testing Library.
- E2E tests: Playwright.
- Schema validation: Zod.
- Type checks: TypeScript.
- Linting: ESLint.

## 5. Codex steering pattern

Use this pattern when prompting Codex:

```txt
Implement [slice name].

Constraints:
- Do not implement future slices.
- Do not add placeholder features unless the spec requests them.
- Preserve existing tests.
- Add tests for the acceptance criteria.
- Use typed data contracts.
- Summarize the diff after implementation.

Acceptance criteria:
[paste criteria]

Test criteria:
[paste criteria]
```

## 6. How to correct Codex when it overbuilds

Use this correction prompt:

```txt
You added functionality outside the current slice.
Please revert or isolate anything not required by the current acceptance criteria.
The slice should stay narrow and pass its tests.
```

## 7. How to correct Codex when it under-tests

Use this correction prompt:

```txt
The implementation is not acceptable until tests cover the listed acceptance criteria.
Add unit, integration, or e2e tests as appropriate.
Do not change product scope.
```
