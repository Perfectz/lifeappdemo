# V14 — Voice Session Alpha

## User outcome
Patrick can see a voice-mode entry point for morning/evening sessions, start a Realtime-compatible session architecture, and capture transcript/handoff data when available.

## Why this slice exists
Voice is important, but it should be layered on top of stable text flows and tools. This slice creates the architecture without derailing the MVP.

## Scope
Build voice-mode foundation.

Features:

- Backend endpoint to create ephemeral Realtime session credentials.
- Frontend voice session UI shell.
- Start/stop controls.
- Transcript panel or placeholder.
- Handoff path from transcript to existing AI text/tool flow.
- Clear error states for unsupported browser/microphone permissions.

## Non-goals
No requirement to perfect full voice UX yet. No native Android microphone bridge. No always-listening mode.

## UI contract
Routes or embedded modes:

- Morning stand-up: Voice Mode button.
- Evening postmortem: Voice Mode button.

Required UI:

- Start Voice Session.
- Stop Voice Session.
- Mic permission status.
- Transcript/status area.
- Fallback to text mode.

## Data contract

```ts
type VoiceSession = {
  id: string;
  mode: 'morning' | 'evening' | 'general';
  status: 'idle' | 'connecting' | 'active' | 'ended' | 'failed';
  transcript?: string;
  startedAt?: string;
  endedAt?: string;
};
```

Do not store raw audio in MVP unless explicitly needed later.

## API contract
Endpoint: `POST /api/realtime/session`

Request:

```ts
type CreateRealtimeSessionRequest = {
  mode: 'morning' | 'evening' | 'general';
};
```

Response:

```ts
type CreateRealtimeSessionResponse = {
  clientSecret: string;
  expiresAt?: string;
  mode: string;
};
```

Security:

- Browser receives only ephemeral credential.
- Permanent OpenAI key stays server-side.
- Validate mode.

## Acceptance criteria

### AC1: Voice entry point visible
Given Patrick opens morning or evening flow, when voice mode is available, then he sees a Voice Mode button.

### AC2: Create session server-side
Given Patrick starts voice mode, when the frontend requests `/api/realtime/session`, then the backend returns an ephemeral client credential or a mocked test credential in test mode.

### AC3: Permanent key not exposed
Given frontend code and network responses are inspected, then the permanent OpenAI API key is never exposed.

### AC4: Permission handling
Given microphone permission is denied, when Patrick starts voice mode, then the UI shows a clear fallback to text mode.

### AC5: Transcript handoff
Given a transcript is captured or mocked, when Patrick ends the session, then the transcript can be handed into the existing text AI flow for tool proposals.

## Test criteria

### Unit tests
- VoiceSession state reducer.
- Realtime session request validation.

### Integration tests
- `/api/realtime/session` rejects invalid mode.
- `/api/realtime/session` returns mocked ephemeral credential in test environment.
- Does not return permanent API key.

### E2E tests
- Start voice mode with mocked session → active state shown → stop → transcript handoff available.
- Permission denied path shows fallback.

### Security tests
- No permanent key in client response.
- Realtime credentials are not stored in local storage.

## Codex prompt

```txt
Implement V14 Voice Session Alpha only.

Add /api/realtime/session for ephemeral Realtime credentials, a voice-mode UI shell in morning/evening flows, voice session state handling, permission/error states, and transcript handoff to existing text AI flow.
Use mocks in tests.
Do not expose permanent OpenAI keys.
Do not implement always-listening mode, native Android wrapper, or raw audio storage.
```

## Review checklist
- Is voice architecture secure?
- Does text fallback remain strong?
- Can transcript handoff reuse existing confirmed tool flow?
