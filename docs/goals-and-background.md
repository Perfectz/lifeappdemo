# Goals & Background

## Purpose

LifeQuest OS exists to turn a personal health-and-discipline transformation into a sustainable daily system. Rather than a generic tracker, it is a coach-in-an-app: it tells the user what matters *today*, makes logging nearly frictionless, and reflects their progress back to them in a way that reinforces the identity they are building.

## The four pillars

The product vision is organized around four life pillars. In day-to-day use, **Health** is the dominant, most fully built-out pillar, with the others framing the broader life-operating-system ambition.

1. **Health** — daily vitals (glucose, blood pressure, weight), sleep and energy, and the fitness routine. This is the core of the current app: the dashboard brief, vitals tracking, daily fitness, and progress photos all live here.
2. **Wealth** — work/career and financial discipline, surfaced through quests/tasks tagged for work and admin and through goals.
3. **Relationships** — the people and social context that matter, captured in the personal wiki and through social-tagged quests and journaling.
4. **Freedom** — the long-term outcome the other three serve: the autonomy and capability that come from being healthy, disciplined, and on top of one's commitments.

> Note on the domain code: the explicit `Goal` entity models three goal *pillars* (`fitness`, `personal`, `professional`) in an OKR-style vision → yearly → quarterly → weekly cascade. The "four pillars" above are the broader product framing; the goals data model is a narrower, concrete implementation of pillar-aligned objectives.

## Focus: daily vitals + fitness habit-building

The app is built around a repeatable daily structure:

- **Morning vitals.** Each day the user logs glucose, blood pressure, and weight. The dashboard brief flags vitals as overdue past a morning deadline so they don't slip.
- **Three training sessions a day.** The fitness model expects three logged sessions daily — one **strength** session (one of a five-day split: e.g. Chest & Biceps, Back & Shoulders, Legs & Core, Chest & Arms, Shoulders & Back, each with free-weight / machine / kettlebell variants and form cues), one **cardio** session (walk, run, jog, DDR, or bike + weight vest), and one **martial arts** session (boxing/kickboxing/karate options). The dashboard tracks "N/3 done" with per-session deadlines.
- **Plan and reflect.** A morning stand-up sets the day's main quest and intention; journaling and reports close the loop.

The goal is **habit-building through a tight daily loop**: see what's due, do it, log it, watch the streak and trends build.

## The role of the AI coach

The AI coach is the connective tissue that makes the data meaningful. Its role:

- **Ground guidance in real data.** The coach is given the user's recent tasks, metrics, journal entries, derived behavioral insights, and their self-authored "About Me" profile, so it speaks to their actual situation.
- **Reinforce the future-self identity.** It frames choices around who the user is becoming ("what would that future self do?"), staying encouraging but honest.
- **Propose, never silently act.** For any data or task change, the coach only emits *proposals*; the user confirms before anything is applied. This keeps the user in control and the deterministic app authoritative.
- **Stay in its lane on health.** It logs values without diagnosing or prescribing, and uses bounded, non-clinical language for concerning readings (e.g. "consider discussing with a healthcare professional").
- **Be optional.** Everything works without it. The coach, vision capture, voice agent, and AI-written daily brief all degrade gracefully to the deterministic experience when no API key is present.

## Background framing (kept generic)

The app is shaped around one person's real transformation journey toward a healthier, more disciplined future self. That individual's private details — specific health conditions, readings, medications, people, and goals — live only in the user's locally stored "About Me" wiki and are deliberately kept out of the source code and this documentation. What's documented here is the **product and its concepts**, which apply to anyone pursuing a similar transformation.
