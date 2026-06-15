# Deploying LifeQuest OS

Stack: **Vercel** (Next.js app + serverless API routes) + **Supabase** (auth + cloud data sync).

## Prerequisites

- Code pushed to GitHub: `Perfectz/lifeappdemo` (branch `main`).
- A Vercel account (sign in with GitHub).
- A Supabase account (sign in with GitHub).

> Do NOT use `npm run build:pages` for Vercel — that script strips the `/api`
> routes for GitHub Pages (static export). Vercel must run plain `next build`.

---

## 1. Vercel (gets the app live)

1. https://vercel.com → **Continue with GitHub**.
2. **Add New → Project** → import `lifeappdemo`.
3. Framework preset auto-detects **Next.js**. Leave build settings default.
4. Add **Environment Variables** (Production + Preview + Development):
   - `OPENAI_API_KEY` (the only AI secret — model ids live in code at `src/config/ai.ts`)
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
5. **Deploy.** You get `https://<project>.vercel.app`.
6. After this, every push to `main` = production deploy; every PR = preview URL.

### Cost
- **Hobby tier = $0** for personal/non-commercial use.
- OpenAI usage is the only meaningful variable cost (~$5–20/mo solo).
- Set a hard monthly spend cap in the OpenAI dashboard.

---

## 2. Supabase (auth + sync)

1. https://supabase.com → **New project** (pick a region near you).
2. Wait for it to provision (~2 min).
3. **Project Settings → API**: copy
   - Project URL → `NEXT_PUBLIC_SUPABASE_URL`
   - `anon` `public` key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `service_role` key (secret!) → `SUPABASE_SERVICE_ROLE_KEY`
4. Paste all three into `.env.local` (local dev) and Vercel env vars (prod).
5. Run the schema in **SQL Editor** (see `supabase/schema.sql`, added when sync is wired).
6. **Authentication → Providers**: enable Email (magic link) and optionally Google.

### Cost
- **Free tier**: 500 MB database, 1 GB file storage, 50K monthly active users,
  social auth. Far beyond a single user's needs → **$0**.
- Pro = $25/mo only if you outgrow the free limits.
