# Watch → App Health Sync — Plan

How LifeQuest OS ingests Galaxy Watch (Samsung Health) data, today and in the
future. Two tracks: **(1) Manual CSV import — shipped**, and **(3) Native
auto-sync via Health Connect — planned**.

---

## Track 1 — Manual CSV import (SHIPPED)

**Status:** Live. Works with the current static PWA on GitHub Pages.

**Flow:** Galaxy Watch → syncs to **Samsung Health** on the paired phone →
`Settings → Download personal data` → ZIP of CSVs → upload a CSV on the
**Health Import** screen → preview → confirm → metrics saved.

**What was built**
- `src/domain/healthImport.ts` now parses Samsung Health's *real* export format:
  - Skips the datatype/version preamble line (e.g. `com.samsung.shealth.step_daily_trend,16`).
  - Matches dotted column names by their final segment
    (`com.samsung.health.step_count.count` → `count`).
  - Parses epoch-millisecond and epoch-second timestamps.
  - Recognizes `day_time`, `start_time`, `sleep_duration`, etc.
- In-app export instructions on the Health Import screen.
- Mappings: steps → `steps`, sleep → `sleepHours`, heart rate → notes,
  exercise → `workoutSummary`, blood pressure → systolic/diastolic.

**Limitations (honest)**
- Manual: the user re-exports + uploads whenever they want fresh data.
- Samsung's CSV schema varies by app version/locale; if a specific export
  doesn't map, share a header sample and the parser candidate lists get extended.
- A static website **cannot** read the watch, Samsung Health, or Health Connect
  directly — there is no browser API for it. That is the entire reason Track 3
  requires a native shell.

---

## Track 3 — Native auto-sync via Health Connect (PLANNED)

**Goal:** Background, automatic sync — no manual export — so steps/sleep/HR/
workouts flow into the app on their own.

### Why native is required
On Android, Samsung Health writes to **Health Connect** (the OS-level health
data store). Only an installed **native Android app** holding Health Connect
permissions can read it. A PWA in a browser tab cannot. So the app must ship as
a native Android package that embeds the existing web UI and adds a native
data bridge.

### Recommended architecture: Capacitor wrapper

```
┌─────────────────────────────────────────────────────────┐
│ Android app (Capacitor)                                  │
│                                                          │
│  ┌────────────────────────┐   bridge   ┌──────────────┐ │
│  │ Existing web UI (WKView)│ ◀───────▶ │ Native plugin │ │
│  │  - same React app       │  JS<->Kt   │  Health       │ │
│  │  - Health Import screen │            │  Connect API  │ │
│  └────────────────────────┘            └──────┬───────┘ │
│                                                │         │
│                                         Health Connect    │
│                                         (Samsung Health)   │
└─────────────────────────────────────────────────────────┘
```

**Why Capacitor over a bare TWA:** a Trusted Web Activity is just a fullscreen
browser with no native API access — it can't read Health Connect. Capacitor
runs the same web build inside a native container *and* exposes a JS↔Kotlin
bridge, so the existing React app is reused almost verbatim; only a thin native
plugin is added.

### Implementation steps
1. **Add Capacitor** to the repo (`@capacitor/core`, `@capacitor/android`).
   Point `webDir` at the existing static export (`out/`). The web app needs
   **no rewrite** — it already runs fully client-side.
2. **Health Connect native plugin (Kotlin)** using `androidx.health.connect:connect-client`:
   - Request read permissions: `StepsRecord`, `SleepSessionRecord`,
     `HeartRateRecord`, `ExerciseSessionRecord`, `BloodPressureRecord`.
   - Read records since the last sync timestamp.
3. **Bridge into the existing pipeline.** The plugin returns records as JSON in
   the **same shape the importer already accepts**, then calls the existing
   `parseHealthImportText` / `confirmHealthImport` path — so all the mapping,
   de-dupe, and preview logic is reused. (Add a small adapter that maps Health
   Connect record objects to the importer's row shape.)
4. **Background sync.** Use a `WorkManager` periodic job (Health Connect's
   background read permission) to pull deltas ~1–4×/day and write metrics via
   the bridge. Foreground "Sync now" button as the fallback.
5. **Settings UI.** Add a "Connect Health" panel (permission request + last-sync
   time + manual sync). Reuses the existing settings-panel pattern.

### Hard requirements / caveats
- **Google Play distribution + Health data review.** Apps reading Health
  Connect must be distributed through Play and pass Google's health-data
  declaration review (privacy policy, data-use justification). Sideloading an
  APK works for personal use without review, which is the fast path for one user.
- **Android only.** iOS has no Health Connect; an iOS build would need a
  separate HealthKit plugin (and Samsung Health doesn't write to HealthKit, so
  iOS + Galaxy Watch is a non-starter without Samsung's own SDK).
- **Min Android / Health Connect availability.** Health Connect ships with
  Android 14+ and is an installable system app on 13. The user's phone must have
  Samsung Health configured to write to Health Connect (a toggle in Samsung
  Health → Settings → Health Connect).
- The static **GitHub Pages PWA stays as-is** for desktop/iOS/quick use; the
  native build is an *additional* distribution of the same codebase.

### Effort estimate
- Capacitor scaffolding + reuse existing build: ~0.5 day.
- Health Connect plugin (permissions + read + adapter to importer shape): ~1–2 days.
- Background WorkManager sync + Settings UI: ~1 day.
- Play review + store listing (if distributing publicly): days–weeks of
  calendar time (review latency), not active work. Sideload APK avoids it.

**Net:** a working sideloaded auto-sync build is ~2–3 focused days. Public Play
release adds review overhead.

---

## Recommendation
Use Track 1 now (it's live). Pursue Track 3 when manual export becomes annoying
enough to justify a native Android build — the existing import pipeline is
already structured so the native bridge can reuse it without duplicating logic.
