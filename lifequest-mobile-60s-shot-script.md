# LifeQuest OS — Mobile · 60-Second Hyperframe Shot Script (Cheeky Cut)

**Concept:** "Play your life." Your day runs like a JRPG — log real nutrition, workouts, and quests, boss a tiny AI party member around by voice, and *level up* off chores. Self-improvement, but make it a video game.
**Format:** 9:16 vertical, 60s, ~11 frames.
**Look:** PSX-era dark menus, pixel hero sprite, neon-cyan headers, HP/MP bars, unreasonable amounts of sparkle.
**Music:** chiptune, ~120 BPM, gremlin energy, building to a triumphant level-up arpeggio.
**Through-line tag (faint lower third):** *Track it. Live it. Flex on your past self.*
**POC note (one card, Shot 1):** it's a proof of concept for a personal "LLM wiki" second brain — Week 1 is health, because abs are a good first boss. Kept to one beat so the rest stays on features.
**Tone rule:** captions are the punchlines. Keep them short, dry, and slightly unhinged. Every line doubles as muted-autoplay text.

---

## Shot 1 — Boot / The Premise
- **Time:** 0:00–0:05 (5s)
- **Frame:** `tour-mobile-dashboard.png` (Today command center, hero sprite waving)
- **Action:** Pixel boot-up wipe → Dashboard. Hero idle-bounces like he's been waiting for you. Framing card flashes: `POC: my life, but it's an RPG now.`
- **Caption:** `Your day. Now with a save file.`
- **SFX:** Console power-on + chiptune downbeat.

## Shot 2 — Nutrition: Barcode Scanner
- **Time:** 0:05–0:13 (8s)
- **Frame:** Live capture `/nutrition` → barcode scan (`FoodSearch` / `MealPhotoLogger`)
- **Action:** Tap **Scan**, point at a snack barcode, *beep* — OpenFoodFacts coughs up the calories and macros instantly. Item drops into the Food Diary.
- **Caption:** `Scan the snack. It knows. It always knows.`
- **SFX:** Scanner beep + guilty little chime.

## Shot 3 — Nutrition: The Diary Fills
- **Time:** 0:13–0:18 (5s)
- **Frame:** Live capture `/nutrition` (`NutritionDiary`) — calorie ring + macro bars
- **Action:** Calorie ring fills toward budget; protein/carb/fat bars race. "Remaining" number rolls down, slightly judgmentally.
- **Caption:** `Macros tracked. Excuses: not found.`
- **SFX:** Stat-fill ticks.

## Shot 4 — Workouts: Three Daily Sessions
- **Time:** 0:18–0:25 (7s)
- **Frame:** Live capture `/fitness` (`DailyFitness`) — strength / cardio / martial arts
- **Action:** "0/3 sessions" → log a strength set (Free Weight / Machine / KB), check it; counter climbs 1/3 → 2/3. Hero starts to look smug.
- **Caption:** `Three workouts a day. Yes, the app is judging you. Lovingly.`
- **SFX:** Plate clink + power-up swell.

## Shot 5 — Quest Log (To-Do List)
- **Time:** 0:25–0:32 (7s)
- **Frame:** `review-tasks-mobile.png` (Quest Log)
- **Action:** Green **+** pulses → quick-add a quest; tap the checkbox → ✓ confetti burst; card slides to "Cleared", counter 0 → 1.
- **Caption:** `It's just a to-do list. But "Quest Log" makes laundry heroic.`
- **SFX:** Button pop + coin "ka-ching".

## Shot 6 — AI Integration: Photo Capture → Data
- **Time:** 0:32–0:39 (7s)
- **Frame:** Live capture `/capture` (`ImageUpdate`) — vision update
- **Action:** Snap a steps screenshot / BP monitor / sad desk lunch; AI reads it and hands back a **confirm-first** proposal card. Tap **Confirm**.
- **Caption:** `Take a photo. The AI does the typing. You do the flexing.`
- **SFX:** Vision scan-sweep + confirm chime.

## Shot 7 — AI Coach Chat
- **Time:** 0:39–0:45 (6s)
- **Frame:** `review-coach-mobile.png` (AI Coach — Coach Chat)
- **Action:** Question bubble rises; Coach replies under the "Task changes require confirmation" pill. Tiny overlay: `reading: About Me wiki + today's data`.
- **Caption:** `A coach that read your file. Encouraging, honest, never a suck-up.`
- **SFX:** Message blips.

## Shot 8 — Voice Chat (Hands-Free)
- **Time:** 0:45–0:51 (6s)
- **Frame:** Live capture voice agent (`VoiceAgent` / `VoiceSessionPanel`)
- **Action:** Mic orb glows + waveform pulses; spoken caption "log a 30-minute walk"; a cardio entry appears and a quest checks itself off. No thumbs required.
- **Caption:** `Talk to it like a minion. It actually listens.`
- **SFX:** Mic shimmer + "listening" tone.

## Shot 9 — Leveling System: Character Sheet
- **Time:** 0:51–0:56 (5s)
- **Frame:** Live capture `/character` (`CharacterScreen`) — LV, XP, HP/MP, streak
- **Action:** Pan the PSX stat panel: **LV**, XP bar (5 quests = 1 level), **HP** = energy, **MP** = mood, streak counter ticking like a tiny scoreboard of your discipline.
- **Caption:** `Yes, you get XP for drinking water. We don't make the rules. (We do.)`
- **SFX:** Stat-readout blips.

## Shot 10 — Boss Battle + LEVEL UP
- **Time:** 0:56–0:59 (3s)
- **Frame:** `/character` boss list (`bosses`) → `LevelUpToast` overlay
- **Action:** A health "boss" HP bar drains as a real metric improves → DEFEATED. Screen-flash, "LEVEL UP!" slams in over the victorious hero.
- **Caption:** `Boss defeated: Bad Sleep. Loot: being a functional human.`
- **SFX:** Level-up arpeggio (rising, glorious).

## Shot 11 — Logo / Tagline
- **Time:** 0:59–1:00 (1s)
- **Frame:** LifeQuest OS logo lockup + small hero sprite
- **Action:** Logo settles, tagline fades up.
- **Caption:** `LifeQuest OS — touch grass, gain XP.`
- **SFX:** Final chiptune resolve.

---

## Feature checklist (all covered)
- **Nutrition tracking** — Shots 2–3 (barcode + diary, calories & macros)
- **Barcode scanner** — Shot 2 (OpenFoodFacts)
- **Workouts** — Shot 4 (3 daily sessions)
- **To-do list** — Shot 5 (Quest Log)
- **AI integration** — Shots 6–7 (photo→data vision + grounded coach)
- **Voice chat** — Shot 8 (realtime hands-free)
- **Leveling system** — Shots 9–10 (LV/XP, HP/MP, streak, bosses, level-up)
- **JRPG concept** — wraps everything (sprite, menus, HP bars, SFX, quest/boss language)

## Production notes
- **Frames on hand:** `tour-mobile-dashboard.png`, `review-tasks-mobile.png`, `review-coach-mobile.png` exist in the repo. The other shots use JRPG-styled mock frames (built to match the app) — swap in live `/nutrition`, `/fitness`, `/capture`, voice, `/character` screen-recordings when available for the final cut.
- **Pacing:** cut on chiptune downbeats; let the AI + voice beats (6–8) breathe before the leveling payoff.
- **Caption-safe & accessible:** captions ≥28px, white/cyan on dark; keep the Shot 10 flash under ~150ms.
- **Keep it kind:** cheeky, never mean. The coach is "honest, never flattering" — punchlines tease the user, not shame them. Keep the in-app "personal patterns, not medical advice" line legible in one vitals frame.
