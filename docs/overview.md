# Overview

## What LifeQuest OS is

LifeQuest OS is a **local-first personal health, fitness, and life-coaching PWA** with a retro JRPG ("PSX-era menu") aesthetic. It is a single-user "operating system for your life": one place to log daily vitals, run a fixed daily training routine, capture quests and reflections, track a physical transformation through progress photos, and talk to an AI coach by text or voice.

The app is built to run instantly and offline. All of a user's data lives on their own device first (browser `localStorage` plus IndexedDB for photos). An optional Supabase layer can back that data up and sync it across devices, and an optional OpenAI integration powers the AI coaching. With neither configured, the deterministic core still works completely.

## Who it's for

A single, motivated individual who wants to take ownership of their health and daily discipline and treat self-improvement like a game with a clear "main quest." The product is intentionally opinionated and personal rather than a generic multi-tenant SaaS — it is shaped around one person's daily structure (vitals in the morning, three training sessions a day, evening reflection) but the *concepts* generalize to anyone pursuing a health and habit transformation.

## Core philosophy: identity transformation, not just tracking

The central idea is that lasting change comes from **becoming a different person**, not from logging numbers. The app frames the user as someone deliberately transforming into a healthier, more disciplined **future self**.

- Throughout the AI coaching, the recurring prompt is *"what would my future self do?"* — connecting today's concrete choices (food, training, sleep, vitals, focus) back to that identity.
- The coach is instructed to be **encouraging and honest, never flattering**, and to prioritize the user's stated top health priorities.
- Numbers (vitals, workouts, photos) are inputs to that identity work, not the point in themselves. Progress photos, for example, exist to make the transformation *visible* over time.

The future-self concept is described here in the abstract: the app helps a user become a healthier, more disciplined version of themselves. The user's individual private profile (their "About Me" wiki) is authored and stored by the user locally and is never part of the codebase.

## High-level value

- **One daily loop.** A dashboard "daily brief" tells the user exactly what still needs them today (vitals, the three workouts, today's plan) with one-tap deep links.
- **Frictionless logging.** Manual forms, plus AI-assisted capture from a photo, plus a hands-free voice agent that can log workouts and check-ins by speaking.
- **Grounded coaching.** The AI coach reads the user's real recent data and their self-authored profile, so advice is specific rather than generic — and it can only *propose* changes, which the user confirms.
- **Durable + private by default.** Local-first storage means instant reads and full offline use; the most sensitive data (progress photos) never leaves the device automatically.
