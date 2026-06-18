# AI Integration

AI is an **optional enhancement layer** over a fully functional deterministic app. Everything below degrades gracefully when `OPENAI_API_KEY` is not set (and Supabase has its own independent graceful degradation for sync/auth).

## Components

### 1. AI Coach chat (read-only + confirmation-gated tools)
- **Route:** `POST /api/ai/chat` ([`src/app/api/ai/chat/route.ts`](../src/app/api/ai/chat/route.ts)) → server client `completeReadOnlyCoachChat` in [`src/server/ai/openaiClient.ts`](../src/server/ai/openaiClient.ts).
- **Read-only:** the coach never mutates data directly. For any task/data change it returns **proposals** (JSON `{ message, proposals[] }`); the system prompt explicitly forbids claiming a change is already applied.
- **Tool proposals** are validated and applied through [`src/domain/aiTaskTools.ts`](../src/domain/aiTaskTools.ts) (`aiTaskToolNames`: `create_task`, `update_task`, `complete_task`, `defer_task`, `archive_task`, `log_metric`, `create_journal_entry`, `propose_daily_plan`, `generate_daily_report`). Each proposal's payload is sanitized/validated against the same domain validators the manual UI uses.
- **Confirmation gate:** the user confirms a proposal, which is applied via `POST /api/ai/tools/confirm` ([`src/app/api/ai/tools/confirm/route.ts`](../src/app/api/ai/tools/confirm/route.ts)) → `applyAITaskToolProposal`. The route returns the updated collections, which the client persists locally.
- **Context:** [`src/domain/aiContext.ts`](../src/domain/aiContext.ts) builds an `AIAppContext` (open tasks, today's plan, recent metrics, recent journal entries, latest report, and **derived behavioral insight highlights** from `insights.ts`) and formats it for the prompt. Multi-turn: the last ~10 history turns are included.
- **Identity grounding:** the coach is told the user is becoming a specific future self (their About Me profile, when present), and to frame guidance around "what would that future self do?" — encouraging but honest, prioritizing the user's stated health priorities, no diagnosis/treatment, bounded language for concerning values.

### 2. Vision capture pipeline
- **Route:** `POST /api/ai/vision` ([`src/app/api/ai/vision/route.ts`](../src/app/api/ai/vision/route.ts)) → `extractUpdatesFromImage` in [`src/server/ai/visionClient.ts`](../src/server/ai/visionClient.ts).
- Accepts one `data:image/...` data URL (size-capped ~6 MB) plus an optional user note/correction. The model maps what it sees (steps screenshot, watch/treadmill summary, BP monitor, a meal, a whiteboard note) onto strict-JSON proposals: `log_metric`, `log_cardio`, `log_strength`, `log_martial_arts`, `create_quest`, `add_journal_entry`. It returns `summary`, a `confidence`, an optional clarifying `question`, and labeled proposals. It is instructed to **never invent values** and to ask rather than guess. Parsing in [`src/domain/visionUpdates.ts`](../src/domain/visionUpdates.ts).

### 3. Progress photo assessment
- **Route:** `POST /api/ai/progress` ([`src/app/api/ai/progress/route.ts`](../src/app/api/ai/progress/route.ts)) → `assessProgressPhotos` in [`src/server/ai/progressClient.ts`](../src/server/ai/progressClient.ts).
- Accepts 1–3 angle-tagged photos (front/profile/face) plus the user's goal/future-self context. Returns strict JSON: `summary`, `alignment` (`on_track`/`needs_work`/`unclear`), `observations[]`, `encouragement`, optional `estimatedBodyFatRange` (framed as a rough visual range only). It comments only on what's visible, never diagnoses, and is honest rather than flattering. The photos themselves stay device-local (IndexedDB) and are sent to the model **only on explicit user request**.

### 4. Daily brief prose
- **Route:** `POST /api/ai/brief` ([`src/app/api/ai/brief/route.ts`](../src/app/api/ai/brief/route.ts)) → `generateCoachBrief` in [`src/server/ai/briefClient.ts`](../src/server/ai/briefClient.ts).
- The structured focus items + CTAs are **deterministic** (`dailyBrief.ts`) so the dashboard is always reliable; this endpoint only writes one short, warm spoken-style sentence on top.

### 5. Realtime voice agent
- **Token route:** `POST /api/realtime/session` ([`src/app/api/realtime/session/route.ts`](../src/app/api/realtime/session/route.ts)) → `createRealtimeClientSecret` in [`src/server/ai/realtimeClient.ts`](../src/server/ai/realtimeClient.ts), which mints a short-lived (10 min) ephemeral client secret bound to `REALTIME_VOICE_MODEL`. In tests/dev without a key it returns a mock secret.
- **Client:** [`src/client/voiceAgent.ts`](../src/client/voiceAgent.ts) opens a WebRTC peer connection (mic up, audio down) + a data channel to OpenAI's realtime endpoint, sends the session config (instructions + tool schema), and runs tool calls locally.
- **voiceTools** ([`src/client/voiceTools.ts`](../src/client/voiceTools.ts)) defines the agent's actions, executed directly against the local repositories (which dispatch `data-changed` → live UI refresh + cloud sync). Scope is intentionally additive/safe — **no delete or archive over voice**:
  - *Actions:* `create_quest`, `complete_quest`, `log_cardio`, `log_strength`, `log_martial_arts`, `log_metric`, `add_journal_entry`, `save_note`, `navigate`.
  - *Read/context (silent):* `get_context`, `list_quests`, `list_recent_workouts`, `read_notes`, `read_about_me`.

## Personal wiki (About Me) as identity context

The user's self-authored [`PersonalWiki`](../src/domain/personalWiki.ts) is the identity context that personalizes the AI:
- In **chat**, the wiki text is sent as `aboutMe` and prepended to the app context as "About the user (their self-profile)" (capped to ~8,000 chars).
- The **voice agent** can read it on demand via the `read_about_me` tool (`formatWikiForPrompt`).
- **Progress assessment** uses it as `goalContext` to ground the read against the user's actual goal.

This follows the "LLM wiki" pattern: a curated, human-authored knowledge base the agents read for context. It is stored locally (and optionally synced), never committed to source.

## Model configuration

Model ids are a **product decision in code**, not secrets — see [`src/config/ai.ts`](../src/config/ai.ts):
- `COACH_MODEL` — text model for chat, brief, vision, and progress. Default `gpt-5.5`; override with `OPENAI_COACH_MODEL`.
- `REALTIME_VOICE_MODEL` — realtime voice model. Default `gpt-realtime-2`; override with `OPENAI_REALTIME_MODEL`.
- `isReasoningModel(model)` (matches `gpt-5*` / `o<digit>*`) drives the request builder `chatCompletionBody`: reasoning models use `max_completion_tokens` + `reasoning_effort` and reject `temperature`; classic models use `temperature`. This lets one builder serve both families.

## Rate limiting & guards

- Every AI route calls the in-memory fixed-window limiter ([`src/server/ai/rateLimiter.ts`](../src/server/ai/rateLimiter.ts)): default **20 requests / 60s per key** (`ai-chat`, `ai-brief`, `ai-vision`, `ai-progress`), returning `429` with a `Retry-After` header. It is per server instance, not distributed — sufficient for a single-user app.
- Each server client caps output tokens (`OPENAI_MAX_TOKENS`) and aborts hung requests via an `AbortController` (`OPENAI_TIMEOUT_MS`). Routes set `maxDuration = 60` so the platform doesn't cut off the in-code timeout.
- `buildOpenAIError` surfaces actionable upstream errors (401 → bad key, 429 → rate/quota, 400/404 → unsupported model/params) via `OpenAIRequestError`, preserving the status so routes return `429` vs `502` appropriately.

## Graceful degradation when no key is set

- Server clients throw `AINotConfiguredError` when `OPENAI_API_KEY` is absent; routes catch it and return **503** with a friendly message (e.g. "AI coach isn't configured. The deterministic app works fully without it — add an OpenAI API key to enable coaching.").
- The realtime token route returns a **mock** secret in test/dev without a key (and only hard-fails in production).
- No AI feature is on the critical path: the dashboard brief, logging, planning, reports, and trends all work deterministically and offline.

## Environment variables

| Var | Required? | Purpose |
| --- | --- | --- |
| `OPENAI_API_KEY` | Required **for AI** | The only secret needed to enable coach chat, vision, progress, brief, and voice. Absent → AI features degrade gracefully. |
| `OPENAI_COACH_MODEL` | Optional | Override the default coach/text model id. |
| `OPENAI_REALTIME_MODEL` | Optional | Override the default realtime voice model id. |
| `OPENAI_MAX_TOKENS` | Optional | Cap on output tokens per AI call (defaults vary by client, e.g. ~1,200 for chat, ~800 for vision/progress). |
| `OPENAI_TIMEOUT_MS` | Optional | Per-request timeout for AI calls (default 30,000 ms). |

(Supabase/cloud and push features have their own separate env vars; see [architecture.md](./architecture.md) and the repo's deploy/push setup docs.)
