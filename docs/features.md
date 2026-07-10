# Features

Features are grouped by area. Routes are App Router paths under `src/app/`. Navigation is defined in [`src/config/navigation.ts`](../src/config/navigation.ts) (grouped as **Today**, **Reflect**, **Tools**, plus a Settings footer item).

## Today

### Dashboard + AI daily brief
The day's command center. After setup, a deterministic **daily brief** lists exactly what still needs the user today — vitals, scheduled training, overdue quests, protein, water, and whether today is planned — each as a focus item with a one-tap CTA and deep link. Before setup is complete, the dashboard invites calibration instead of marking unconfigured behavior overdue. Active strategic goals and their next linked quests appear directly on the dashboard. When an OpenAI key is present, a short coach-written briefing sentence is layered on top of the deterministic facts.
- Route: `/dashboard`
- Logic: [`src/domain/dailyBrief.ts`](../src/domain/dailyBrief.ts), component [`src/components/Dashboard.tsx`](../src/components/Dashboard.tsx)

### Daily Fitness (schedule-aware)
Tracks strength, cardio, and martial-arts sessions. The training profile can use the legacy three-session daily target or a weekday schedule with explicit recovery days. Completion, reminders, morning status, alignment, and dashboard coaching follow the configured schedule; optional movement on recovery days remains bonus credit.
- Route: `/fitness`
- Config: [`src/config/fitness.ts`](../src/config/fitness.ts); status logic [`src/domain/dailyFitness.ts`](../src/domain/dailyFitness.ts); component [`src/components/DailyFitness.tsx`](../src/components/DailyFitness.tsx)

### Quest Log / Tasks
Capture and clear "quests" (tasks). Tasks have priority, difficulty/XP, tags, recurrence, checklists, due/planned dates, natural-language quick capture, and optional links to strategic goals.
- Route: `/tasks`
- Components: [`src/components/QuestLog.tsx`](../src/components/QuestLog.tsx), `TaskCard`, `TaskGroup`, `TaskForm`, `QuickAddQuest`

### Morning Stand-Up check-in
A guided start to the day: log morning vitals + fitness intent and set the day's **main quest**, side quests, and an **intention**, producing/updating today's `DailyPlan`.
- Route: `/standup/morning`
- Component: [`src/components/MorningStandup.tsx`](../src/components/MorningStandup.tsx)

## Reflect

### Goals
Build a vision → yearly → quarterly → weekly goal hierarchy across health/fitness, personal, and professional pillars. Goals can use numeric progress or derive progress from linked quests. Each goal can create its next concrete quest for today, and the LifeQuest Agent receives active goals as grounding context.
- Route: `/goals`
- Domain: [`src/domain/goals.ts`](../src/domain/goals.ts); component [`src/components/GoalsWorkspace.tsx`](../src/components/GoalsWorkspace.tsx)

### Metrics check-in
A lightweight energy/mood/sleep check-in (1–5 levels, sleep hours, steps, etc.), recorded as a `MetricEntry`.
- Route: `/metrics`
- Component: [`src/components/MetricsCheckIn.tsx`](../src/components/MetricsCheckIn.tsx)

### Vitals (glucose / BP / weight + trends)
Dedicated daily vitals logging — blood glucose (with context), blood pressure (systolic/diastolic), and weight — with trend views over time. Vitals are what the dashboard brief checks for "logged today."
- Route: `/vitals`
- Component: [`src/components/Vitals.tsx`](../src/components/Vitals.tsx); biometric helpers [`src/domain/biometrics.ts`](../src/domain/biometrics.ts)

### Progress Photos (front / profile / face + AI assessment)
Capture a daily set of progress photos in three angles — **front**, **side profile**, and **face close-up** — to track the physical transformation. Stored on-device only (IndexedDB). On request, the user can run an **AI progress assessment** that compares the photos against their stated goal and returns an honest, encouraging read.
- Route: `/progress`
- Component: [`src/components/ProgressPhotos.tsx`](../src/components/ProgressPhotos.tsx); domain [`src/domain/progressPhotos.ts`](../src/domain/progressPhotos.ts), [`src/domain/progressAssessment.ts`](../src/domain/progressAssessment.ts); store [`src/data/progressPhotoStore.ts`](../src/data/progressPhotoStore.ts)

### Health Import (Samsung / Google sleep)
Alpha feature to import health data from a Samsung Health export (and Health Connect-style sleep data). The user uploads files; the app parses and previews mapped records (steps, sleep, blood pressure, etc.), flags duplicates, and confirms them into `MetricEntry` records.
- Route: `/health-import`
- Domain: [`src/domain/healthImport.ts`](../src/domain/healthImport.ts); component [`src/components/HealthImport.tsx`](../src/components/HealthImport.tsx)

### About Me (personal wiki)
A curated, human-authored "About Me" knowledge base with sections (Profile, Health, Nutrition, Training, Goals, Coaching Preferences, People, Constraints, Other). This is identity context the LifeQuest Agent reads. Authored and stored by the user; never committed to source.
- Route: `/profile`
- Domain: [`src/domain/personalWiki.ts`](../src/domain/personalWiki.ts); component [`src/components/PersonalWikiEditor.tsx`](../src/components/PersonalWikiEditor.tsx)

### Journal
Capture lessons and reflections as `JournalEntry` records (morning intention, evening reflection, lesson, freeform). Entries can originate manually, AI-assisted, or from a voice transcript.
- Route: `/journal`
- Domain: [`src/domain/journal.ts`](../src/domain/journal.ts); component [`src/components/Journal.tsx`](../src/components/Journal.tsx)

### Notes
Quick field notes (title, content, tags). The voice agent can also save notes from a conversation.
- Route: `/notes`
- Domain: [`src/domain/notes.ts`](../src/domain/notes.ts); component [`src/components/Notes.tsx`](../src/components/Notes.tsx)

### Trends
Patterns over time across metrics and task completion.
- Route: `/trends`
- Domain: [`src/domain/insights.ts`](../src/domain/insights.ts); component [`src/components/TrendsView.tsx`](../src/components/TrendsView.tsx)

## Tools

### Reports (Daily Plans + Daily Report export)
Generate and export a daily report (markdown) summarizing the day — built deterministically by default, or AI-assisted. Daily plans (main quest, side quests, intention) underpin the report.
- Route: `/reports`
- Domain: [`src/domain/reports.ts`](../src/domain/reports.ts), [`src/domain/dailyPlans.ts`](../src/domain/dailyPlans.ts); component [`src/components/DailyReportExport.tsx`](../src/components/DailyReportExport.tsx)

### LifeQuest Agent (coach + personal assistant)
A multi-turn personal intelligence workspace with four explicit operating modes: **Life Coach** for behavior and decisions, **Assistant** for organizing commitments, **Planner** for realistic daily execution, and **Review** for patterns and lessons. Its compact, expandable context inspector shows exactly which goals, quests, memories, notes, recent activity, and training constraints ground the conversation. The agent can propose task/data changes (create/update/complete/defer/archive task, log metric, create journal entry, propose a daily plan, generate a report) that the user must confirm before they apply. The composer remains reachable while scrolling, and the panel also integrates photo capture and voice.
- Route: `/coach`
- Component: [`src/components/AICoachPanel.tsx`](../src/components/AICoachPanel.tsx); API `POST /api/ai/chat`, confirm `POST /api/ai/tools/confirm`

### Capture (universal inbox)
Drop a commitment, reference note, or reflection into one fast working surface. The first line becomes the title for quests and notes; captures are stored immediately in their native repository so the Agent can organize them later. Photo-to-update vision remains available from the LifeQuest Agent attachment button and returns confirmation-gated proposals.
- Route: `/capture`
- Component: [`src/components/CaptureWorkspace.tsx`](../src/components/CaptureWorkspace.tsx); photo parsing [`src/domain/visionUpdates.ts`](../src/domain/visionUpdates.ts); API `POST /api/ai/vision`

### Gmail assistant
Connect or disconnect Gmail from Settings, load a recent unread inbox digest on demand, and ask the Agent about current email. The Agent can propose a Gmail draft, but it is created only after confirmation and remains in Gmail for review. There is no automatic-send endpoint. OAuth refresh tokens are encrypted server-side and never stored in the browser.

### Voice agent (realtime)
A hands-free realtime voice coach over WebRTC against the OpenAI Realtime model. It can read context and act through voice tools: create/complete quests, log strength/cardio/martial-arts workouts, log check-ins, add journal entries, save notes, read notes/about-me, and navigate screens. Scope is intentionally additive and safe (no delete/archive over voice).
- Surfaced in the LifeQuest Agent panel / voice components.
- Client: [`src/client/voiceAgent.ts`](../src/client/voiceAgent.ts), [`src/client/voiceTools.ts`](../src/client/voiceTools.ts); API `POST /api/realtime/session`; components `VoiceAgent`, `VoiceSessionPanel`

### Settings
Configuration hub: theme picker, data backup/export & import, cloud sync panel, demo mode, install readiness, and (when enabled) push notifications/reminders.
- Route: `/settings`
- Components: `ThemePicker`, `DataBackupPanel`, `CloudSyncPanel`, `DemoModePanel`, `InstallReadinessPanel`, `RemindersPanel`/`PushNotificationsPanel`

## Cross-cutting

### Supabase cloud sync + auth
Optional email/password (and magic-link / Google OAuth) authentication via Supabase. An `AuthGate` requires a signed-in session before rendering the app — but only when Supabase is configured; otherwise it falls through to local-only so a missing key can't lock the user out. When signed in, the full local snapshot is backed up and synced across devices with last-write-wins + optimistic-concurrency conflict handling.
- Client: [`src/client/cloudSync.ts`](../src/client/cloudSync.ts); auth UI [`src/components/AuthGate.tsx`](../src/components/AuthGate.tsx), `LoginScreen`; schema [`supabase/schema.sql`](../supabase/schema.sql)

### PWA / offline
Installable PWA with a service worker, web manifest, offline page, and an offline boundary. App-shell and static assets are cached; API / AI / realtime requests are never cached.
- Service worker: [`public/sw.js`](../public/sw.js); registration [`src/components/PWAServiceWorkerRegister.tsx`](../src/components/PWAServiceWorkerRegister.tsx); route `/offline`, component `OfflineBoundary`

### Health check endpoint
`GET /api/health` returns a simple `{ ok: true, app: "LifeQuest OS" }`.
