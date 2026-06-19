# Data Model

The canonical entity types live in [`src/domain/types.ts`](../src/domain/types.ts) (re-exported via [`src/domain/index.ts`](../src/domain/index.ts)). Most entities extend `TimestampedEntity` (`id: string`, `createdAt`, `updatedAt`, all ISO strings). IDs are generated with `crypto.randomUUID()`.

## Storage at a glance

| Entity | Module | Storage | Cloud-synced? |
| --- | --- | --- | --- |
| `Task` | `tasks.ts` | `localStorage` (`lifequest.tasks.v1`) | Yes |
| `MetricEntry` | `metrics.ts` | `localStorage` (`lifequest.metricEntries.v1`) | Yes |
| `Workout` | `workouts.ts` | `localStorage` (`lifequest.workouts.v1`) | Yes |
| `JournalEntry` | `journal.ts` | `localStorage` (`lifequest.journalEntries.v1`) | Yes |
| `Note` | `notes.ts` | `localStorage` (`lifequest.notes.v1`) | Yes |
| `DailyPlan` | `dailyPlans.ts` | `localStorage` (`lifequest.dailyPlans.v1`) | Yes |
| `DailyReport` | `reports.ts` | `localStorage` (`lifequest.dailyReports.v1`) | Yes |
| `PersonalWiki` (About Me) | `personalWiki.ts` | `localStorage` (`lifequest.wiki.v1`) | Yes |
| Health goals | `healthGoals` repo | `localStorage` (`lifequest.healthGoals.v1`) | Yes |
| `ProgressPhoto` | `progressPhotos.ts` | **IndexedDB** (`lifequest-media`) | **No — device-local only** |
| `VoiceSession` | `voiceSessions.ts` | In-memory (session/UI state) | No |

"Cloud-synced" entities are those captured by the local snapshot that `cloudSync` pushes to Supabase when the user is signed in. **Progress photos are deliberately excluded** from both git and the cloud snapshot because they are large and highly sensitive.

## Entities

### MetricEntry (vitals + check-ins)
A daily check-in / vitals record. Source can be `manual`, `samsung_export`, `health_connect`, or `demo`.
Key fields: `date`, `checkInType` (`morning`/`evening`/`freeform`), `weightLbs`, `sleepHours`, `energyLevel`/`moodLevel` (1–5), `steps`, `workoutSummary`, `kettlebellSwingsTotal`, `karateClass`, `distanceWalkedMiles`, `bloodPressureSystolic`/`bloodPressureDiastolic`, `bloodGlucoseMgDl`, `glucoseContext`, `notes`, `recordedAt`. The dashboard's "vitals logged today" check looks for a same-day entry with BP, glucose, or weight present.

### BiometricReading
A finer-grained, individually time-stamped reading (multiple per day). `kind` ∈ `blood_glucose`, `blood_pressure`, `resting_heart_rate`, `body_weight`, `spo2`. Carries kind-specific fields (`glucoseMgDl` + `glucoseContext`; `systolic`/`diastolic`/`pulseBpm`; generic `value`/`unit`), `recordedAt`, `source`, `notes`. Used by the vitals/biometrics screens. Categorization helpers live in `biometrics.ts`.

### Workout
A logged training session. `type` ∈ `strength`, `cardio`, `martial_arts`; `source` ∈ `manual`/`ai`/`health_connect`/`demo`. Common: `date`, `title`, `durationMinutes`, `intensityRpe`, `caloriesBurned`, `notes`, `recordedAt`. Strength-specific: `equipment[]` (`bodyweight`/`adjustable_dumbbells`/`kettlebell`/`adjustable_bench`) and `sets[]` (`StrengthSet`: `exercise`, `reps`, `weightLbs`, `tempo`, `rpe`, `durationSeconds`). Martial-arts: `techniques[]`, `rounds`. Cardio: `distanceMiles`, `avgHeartRate`, `weightVestLbs`. `dailyFitness.ts` derives the "3 sessions/day" status from these.

### ProgressPhoto (device-local)
A single physique photo. Fields: `id`, `date`, `angle` (`front`/`profile`/`face`), `dataUrl` (a downscaled JPEG data URL), `createdAt`. Helpers group photos per day (`getPhotosForDate`, `groupPhotosByDate`) and report whether a day's set is complete (all three angles). **Stored only in IndexedDB; never synced to cloud or committed.**

### DailyPlan
The day's plan. Fields: `date`, `mainQuestTaskId?`, `sideQuestTaskIds[]`, `intention?`, `status` (`planned`/`closed`). Produced by the morning stand-up and referenced by reports. Validation limits side quests (e.g. ≤ 3) and prevents the main quest from also being a side quest.

### Task
A quest. Fields: `title`, `description?`, `status` (`todo`/`done`/`archived`), `priority` (`low`/`medium`/`high`), `tags[]` (`health`/`work`/`content`/`social`/`admin`/`learning`), `dueDate?`, `plannedForDate?`, `completedAt?`, `archivedAt?`. Lifecycle helpers: `createTask`, `updateTask`, `completeTask`, `archiveTask`.

### JournalEntry
A reflection/lesson. Fields: `date`, `type` (`morning_intention`/`evening_reflection`/`lesson`/`freeform`), `prompt?`, `content`, `linkedDailyPlanId?`, `linkedPostmortemId?`, `source` (`manual`/`ai_assisted`/`voice_transcript`/`demo`).

### Note
A quick note. Fields: `title`, `content`, `tags[]`. Searchable; the voice agent can create these.

### DailyReport
An exportable daily summary. Fields: `date`, `markdownContent`, `generatedBy` (`deterministic`/`ai`). Built by `generateDailyReport` from the day's tasks, plan, metrics, and journal entries.

### PersonalWiki (About Me)
The user-authored identity context. Shape: `{ sections: Record<WikiSectionId, string>, updatedAt }` with section ids `profile`, `health`, `nutrition`, `training`, `goals`, `preferences`, `people`, `constraints`, `other`. Can be parsed from a markdown dump and rendered for an AI prompt (capped to a character budget). Locally stored and synced; intentionally never part of source. This is the data the AI coach and voice agent read for personalization.

### Goal
OKR-style goal hierarchy. Fields: `pillar` (`fitness`/`personal`/`professional`), `horizon` (`vision`/`yearly`/`quarterly`/`weekly`), `title`, `description?`, `parentGoalId?` (the vision → yearly → quarterly → weekly cascade), `targetDate?`, optional measurable target (`metricName`, `targetValue`, `currentValue`, `unit`), and `status` (`active`/`achieved`/`paused`/`dropped`).

### FoodEntry / Macros (nutrition)
A logged meal. Fields: `date`, `mealType` (`breakfast`/`lunch`/`dinner`/`snack`), `description`, `macros` (`calories`, `proteinG`, `carbsG`, `fatG`, `fiberG`), `estimateSource` (`manual`/`photo_ai`/`barcode`/`restaurant_db`), `confidence?`, `photoRef?`, `recordedAt`.

### VoiceSession
Transient state for the realtime voice agent. Fields: `id`, `mode` (`morning`/`evening`/`general`), `status` (`idle`/`connecting`/`active`/`ended`/`failed`), `transcript?`, `startedAt?`, `endedAt?`. Managed by a reducer (`voiceSessionReducer`); not persisted.

### Health import types
`HealthImportBatch` and `ImportedHealthRecord` model a parse/preview/confirm pipeline from a Samsung/Health-Connect export into `MetricEntry` records (see `healthImport.ts`). Records carry `sourceType` (`steps`/`sleep`/`heart_rate`/`workout`/`blood_pressure`/`unknown`), optional `startTime`/`endTime`/`value`/`unit`, and the `raw` source row.

### AI proposal types
`AIToolProposal` represents a confirmation-gated change the coach proposes: `toolName` (`create_task`, `update_task`, `complete_task`, `defer_task`, `archive_task`, `log_metric`, `create_journal_entry`, `propose_daily_plan`, `generate_daily_report`), a human `summary`, a validated `payload`, and `status` (`pending`/`confirmed`/`rejected`/`applied`/`failed`). `AIAppContext` is the read-only snapshot (open tasks, today's plan, recent metrics/journal, latest report, derived insight highlights) passed to the coach.
