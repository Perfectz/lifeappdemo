# V09 — AI Task Tools with Confirmation

## User outcome
Patrick can ask the AI to create, update, complete, defer, or archive tasks, but changes are shown as proposed actions that require confirmation.

## Why this slice exists
This is where the AI becomes useful without becoming dangerous. Confirmation keeps the user in control and makes tool behavior testable.

## Scope
Add backend-validated task tool proposals and a frontend confirmation queue.

Supported AI task actions:

- Create task.
- Update task.
- Complete task.
- Defer task.
- Archive task.

## Non-goals
No metric/journal tools yet. No autonomous batch changes without review. No voice.

## UI contract
In AI coach UI:

- AI response can include proposed actions.
- Proposed actions render as cards.
- Each card has Confirm and Reject.
- Confirm executes the change.
- Reject dismisses it.
- Applied changes are logged in transcript.

## Data contract

```ts
type AIToolProposalStatus = 'pending' | 'confirmed' | 'rejected' | 'applied' | 'failed';

type AIToolProposal = {
  id: string;
  toolName: 'create_task' | 'update_task' | 'complete_task' | 'defer_task' | 'archive_task';
  summary: string;
  payload: unknown;
  status: AIToolProposalStatus;
  createdAt: string;
  updatedAt: string;
};
```

Each payload must be validated with Zod or equivalent.

## API contract

### `POST /api/ai/chat`
Can return:

```ts
type AIChatResponse = {
  message: string;
  proposals?: AIToolProposal[];
};
```

### `POST /api/ai/tools/confirm`
Request:

```ts
type ConfirmToolRequest = {
  proposalId: string;
};
```

Response:

```ts
type ConfirmToolResponse = {
  ok: boolean;
  appliedChangeSummary: string;
};
```

Implementation note: if proposals are not persisted yet, the confirm endpoint can receive the signed/validated proposal payload. Prefer persisted proposals if feasible.

## Acceptance criteria

### AC1: AI proposes task creation
Given Patrick says “Add a task to walk on the treadmill tomorrow,” when the AI responds, then it shows a proposed create-task action instead of silently creating it.

### AC2: Confirm applies change
Given a pending create-task proposal exists, when Patrick confirms it, then the task is created and appears in Quest Log.

### AC3: Reject does not apply
Given a pending proposal exists, when Patrick rejects it, then no task mutation occurs.

### AC4: Complete task proposal
Given an existing task exists, when Patrick asks the AI to mark it done, then a complete-task proposal appears and confirmation completes the task.

### AC5: Payload validation
Given a malformed tool payload is returned or submitted, then the backend rejects it safely and does not mutate data.

### AC6: Audit trail
Given a proposal is confirmed or rejected, then the transcript or proposal state clearly shows the outcome.

## Test criteria

### Unit tests
- Tool payload schemas validate valid payloads.
- Tool payload schemas reject invalid payloads.
- Applying each task tool updates task state correctly.

### Integration tests
- Mock AI response containing proposal creates pending proposal.
- Confirm endpoint applies validated proposal.
- Malformed proposal fails safely.

### E2E tests
- Ask AI to create task → confirm → task appears.
- Ask AI to create task → reject → task does not appear.
- Ask AI to complete task → confirm → task moves to done.

### Security tests
- Tool confirmation cannot execute arbitrary tool names.
- Client cannot bypass validation with malformed payload.

## Codex prompt

```txt
Implement V09 AI Task Tools with Confirmation only.

Extend AI chat so the backend can return validated task tool proposals.
Render pending proposals in the AI coach UI with Confirm and Reject.
Implement confirmation handling that applies only validated task mutations.
Add tests for create/update/complete/defer/archive proposals, reject behavior, malformed payloads, and audit trail.
Do not implement metric tools, journal tools, autonomous mutations, voice, or morning/evening agent flows yet.
```

## Review checklist
- Does the AI ask permission before changing data?
- Are proposed actions understandable?
- Can malformed payloads mutate anything? They should not.
