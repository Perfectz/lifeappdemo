# V08 — AI Chat with Read-Only App Context

## User outcome
Patrick can chat with the AI coach from inside the app, and the AI can reference recent tasks, metrics, plans, journal entries, and reports, but cannot mutate data yet.

## Why this slice exists
This adds the cloud AI safely. Read-only mode proves backend key handling, context packing, and UX before tool calls can change data.

## Scope
Implement text AI chat with a secure backend endpoint.

Capabilities:

- User sends message.
- Backend builds compact context from stored app data.
- Backend calls OpenAI API server-side.
- AI replies in LifeQuest coach style.
- Chat transcript displays in UI.

## Non-goals
No AI tool calls. No data mutation. No voice. No streaming required unless easy.

## UI contract
Route: `/coach` or embedded `AICoachPanel` from dashboard.

Required UI:

- Message list.
- Input field.
- Send button.
- Loading state.
- Error state.
- Context mode label: `Read-only coach mode`.

## Data contract
Create compact context builder:

```ts
type AIAppContext = {
  today: string;
  openTasks: Task[];
  todaysPlan?: DailyPlan;
  recentMetrics: MetricEntry[];
  recentJournalEntries: JournalEntry[];
  latestReport?: DailyReport;
};
```

Context rules:

- Keep context compact.
- Prefer recent data.
- Do not include archived tasks unless relevant.
- Do not include secrets.

## API contract
Endpoint: `POST /api/ai/chat`

Request:

```ts
type AIChatRequest = {
  message: string;
  mode: 'general' | 'morning' | 'evening' | 'report';
};
```

Response:

```ts
type AIChatResponse = {
  message: string;
  mode: string;
  usedContext: {
    openTaskCount: number;
    recentMetricCount: number;
    recentJournalEntryCount: number;
  };
};
```

Security:

- OpenAI API key only on server.
- No permanent key in frontend.
- Validate request body.
- Return safe error messages.

## Acceptance criteria

### AC1: Send chat message
Given Patrick opens the AI coach panel, when he sends a message, then the AI response appears in the message list.

### AC2: Uses app context
Given open tasks and metrics exist, when Patrick asks “What should I focus on today?”, then the backend sends compact app context to the AI.

### AC3: Read-only boundary
Given the AI suggests task changes, when it replies, then no tasks are created, edited, or completed by this slice.

### AC4: Secure key handling
Given the frontend bundle is inspected, then the OpenAI API key is not present.

### AC5: Error handling
Given the backend call fails, when Patrick sends a message, then the UI shows a useful error without exposing secrets.

## Test criteria

### Unit tests
- Request schema validation.
- Context builder includes correct recent records.
- Context builder excludes archived tasks by default.

### Integration tests
- `/api/ai/chat` rejects invalid requests.
- `/api/ai/chat` calls mocked OpenAI client with server-side context.
- Error path returns safe message.

### E2E tests
- User sends message and sees mocked AI response.

### Security tests
- No OpenAI key in client code.
- No secret returned in error response.

## Codex prompt

```txt
Implement V08 AI Chat with Read-Only App Context only.

Create /api/ai/chat with validated request body, server-side OpenAI call, compact app context builder, and safe errors.
Build a text AI coach UI with read-only mode label.
Use mocks in tests so tests do not call the real OpenAI API.
Do not implement AI tool calls, data mutation, voice, streaming, or reports beyond reading existing data.
```

## Review checklist
- Can the AI answer using your app data?
- Are keys safe?
- Did Codex avoid tool calls and mutation?
