# LifeQuest OS — Mobile · 45-Second Hyperframe Shot Script

## Positioning (what this video is pitching)
This is a **proof of concept for Andrej Karpathy's "LLM wiki" idea** — a structured, human-authored personal wiki that an LLM reads as context. In LifeQuest that wiki is the **About Me** profile, and it turns the app into a **second AI brain**: a planner and assistant that knows my real data and goals. The POC starts narrow and concrete — **Week 1 is health** (vitals, training, reflection) — proving the loop before it generalizes to the rest of life. The 45s should land three beats: *(1) I feed it a personal wiki → (2) an LLM reads it and plans/assists with me → (3) it starts working in Week 1 on health.*

**Concept:** "One Day, One Quest" — a real day played like a JRPG, powered by a personal LLM wiki. The phone is the console; each hyperframe is a retro screen transition scored to chiptune.
**Format:** 9:16 vertical, 45s. ~8 frames at ~5s avg.
**Look:** PSX-era dark UI, pixel-art sprite, neon-cyan headers, green accents.
**Through-line lower-third tag (persists faintly):** *A personal wiki my AI brain reads. Week 1: health.*
**Music:** single chiptune track, ~120 BPM, building to a triumphant arpeggio at the level-up.
**Voice:** optional warm VO; works caption-only for muted autoplay.

---

## Shot 1 — Boot / Hook
- **Timecode:** 0:00–0:04 (4s)
- **Frame:** `tour-mobile-dashboard.png` (Today command center, sprite waving)
- **On-screen action:** Pixel boot-up wipe reveals the Dashboard. Sprite does a 2-frame idle bounce. "Today / Thursday, May 28, 2026" header settles in.
- **Camera/motion:** Slow 5% push-in on the phone.
- **Transition out:** Pixel-dissolve wipe (left→right).
- **Caption:** `Wake up. Press start.` → quick second card: `A POC: my life as an LLM wiki.`
- **SFX:** Console power-on sting + soft chiptune downbeat.
- **Note:** the second card frames the whole video — this is a proof of concept for a personal "LLM wiki" second brain, booting on health first.

## Shot 2 — Set the Main Quest
- **Timecode:** 0:04–0:11 (7s)
- **Frame:** `review-morning-mobile.png` (Morning Stand-Up)
- **On-screen action:** Bottom tab-bar highlight slides to **Morning**. Vitals fields fill in; the "Main Quest" line flips from empty → a chosen quest with a subtle glow.
- **Camera/motion:** Vertical scroll from header down to the quick-add card.
- **Transition out:** Page-curl / slide-left.
- **Caption:** `Pick today's Main Quest.`
- **SFX:** Menu-select blips on each field; confirm chime on quest set.

## Shot 3 — Clear Your Quests
- **Timecode:** 0:11–0:18 (7s)
- **Frame:** `review-tasks-mobile.png` (Quest Log)
- **On-screen action:** Green floating **+** pulses and is tapped; a new quest card drops into the list. A checkbox is tapped → ✓ burst, card animates to "Cleared" and the counter rolls 0 → 1.
- **Camera/motion:** Hold steady; let the micro-animations carry it.
- **Transition out:** Coin-flip wipe.
- **Caption:** `Clear your quests.`
- **SFX:** Button pop on `+`; coin/“ka-ching” on the checkmark.

## Shot 4 — Train & Log Vitals
- **Timecode:** 0:18–0:26 (8s)
- **Frame:** `review-metrics-mobile.png` (Metrics / energy + vitals check-in; sprite in side-profile "training" pose)
- **On-screen action:** Check-in type dropdown set to "morning"; energy/sleep/mood sliders tick up; a "N/3 sessions" indicator fills one notch.
- **Camera/motion:** Number roll-up emphasis (quick zoom on the counter).
- **Transition out:** Glitch/scanline wipe.
- **Caption:** `Train. Log. Level up.`
- **SFX:** Stat-increment ticks; light "power-up" swell.

## Shot 5 — The AI Coach
- **Timecode:** 0:26–0:33 (7s)
- **Frame:** `review-coach-mobile.png` (AI Coach — Coach Chat)
- **On-screen action:** A user question bubble rises; the Coach reply types in beneath the "Task changes require confirmation" pill. A small overlay reads `reading: About Me wiki + today's data` to show the LLM is grounded in my personal wiki. A mic/voice icon glows to signal hands-free.
- **Camera/motion:** Gentle scroll following the new chat bubbles.
- **Transition out:** Soft cross-dissolve (calmer beat).
- **Caption:** `It reads my personal wiki — a second brain that plans with me.`
- **SFX:** Message "blip" per bubble; mic shimmer.
- **Note:** this is the payoff shot for the Karpathy "LLM wiki" thesis — the human-authored profile is the context the model reasons over.

## Shot 6 — Close the Day
- **Timecode:** 0:33–0:40 (7s)
- **Frame:** `review-evening-mobile.png` (Evening Postmortem) → quick cut to `review-reports-mobile.png` (Reports / Daily Markdown)
- **On-screen action:** Postmortem "Planned Task Outcomes" get marked; cut to Reports where **Generate Preview** is tapped and a daily report renders.
- **Camera/motion:** Match-cut on the sprite between the two frames so the character "carries" across.
- **Transition out:** White flash into Shot 7.
- **Caption:** `End the day. Watch yourself change.`
- **SFX:** Reflective pad; paper/print whoosh on report generate.

## Shot 7 — Level Up
- **Timecode:** 0:40–0:43 (3s)
- **Frame:** Sprite hero pose from `tour-mobile-dashboard.png` / `public/assets/sprites/patrick-sprite-sheet.png`
- **On-screen action:** Full-screen pixel flash; "LEVEL UP!" overlay slams in over the sprite.
- **Camera/motion:** Punch-in + screen shake (2px).
- **Transition out:** Hard cut to logo.
- **Caption:** `LEVEL UP!`
- **SFX:** Classic level-up arpeggio (rising).

## Shot 8 — Logo / Tagline
- **Timecode:** 0:43–0:45 (2s)
- **Frame:** LifeQuest OS logo lockup (`LQ` mark) on dark, sprite small beside it
- **On-screen action:** Logo settles; tagline fades up.
- **Camera/motion:** Static, slight glow pulse.
- **Caption:** `LifeQuest OS — a personal LLM wiki becoming my second brain. Week 1: health.`
- **SFX:** Final chiptune resolve + soft sub hit.

---

## Production notes
- **Why these frames:** every beat is one thumb-tap away in the real app (tab bar → screen → action), so the hyperframes mirror actual one-handed mobile use.
- **Assets on hand:** all eight screenshots above already exist in the repo root; the sprite sheet is at `public/assets/sprites/patrick-sprite-sheet.png` and nav icons at `public/assets/sprites/lifequest-nav-icon-sheet.png` for transition flourishes.
- **If you can record live screens:** capture device screen-recordings of these same flows at 60fps and use the screenshots as fallback stills; the script timing is unchanged.
- **Pacing:** keep cuts on the chiptune downbeats (~every 0.5s grid). Reflection beat (Shot 5–6) intentionally slows before the level-up payoff.
- **Caption-only safe:** all VO lines double as on-screen captions for muted social autoplay.
- **Accessibility:** keep caption text ≥ 28px, high-contrast white on the dark UI; avoid full-frame flashes longer than ~150ms (Shot 7 flash kept brief).
