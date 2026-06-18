# Enabling phone reminders (push notifications)

Push reminders are **built but dormant behind a feature flag**. They fire even
when the app is closed, nudging you when you haven't logged:

- **Vitals** by 7:30am
- **Workout 1** by 9:00am, **Workout 2** by 6:00pm, **Workout 3** by 9:00pm

How it works: the device subscribes to web push (stored in Supabase
`push_subscriptions`), and a Vercel Cron job runs at each deadline, reads your
*synced* data from Supabase, and pushes a reminder if the item isn't done.

## To turn it on

1. **Generate VAPID keys**
   ```bash
   npx web-push generate-vapid-keys
   ```

2. **Add env vars** (Vercel → Settings → Environment Variables, and `.env.local`):
   - `NEXT_PUBLIC_PUSH_ENABLED=true`
   - `NEXT_PUBLIC_VAPID_PUBLIC_KEY=<public key>`
   - `VAPID_PRIVATE_KEY=<private key>` (secret)
   - `VAPID_SUBJECT=mailto:you@example.com`
   - `SUPABASE_SERVICE_ROLE_KEY=<from Supabase → Settings → API>` (secret — the cron reads all users' data)
   - `CRON_SECRET=<random string>` (Vercel sends it to authorize the cron)

3. **Create the table** (already applied to the current project, but for a fresh DB):
   run `supabase/push-schema.sql` in the Supabase SQL editor.

4. **Schedule the cron** — add to `vercel.json` (cron times are **UTC**; convert
   from your local times). Multiple daily schedules require the **Vercel Pro** plan.
   ```json
   {
     "crons": [
       { "path": "/api/cron/reminders", "schedule": "30 11 * * *" },
       { "path": "/api/cron/reminders", "schedule": "0 13 * * *" },
       { "path": "/api/cron/reminders", "schedule": "0 22 * * *" },
       { "path": "/api/cron/reminders", "schedule": "0 1 * * *" }
     ]
   }
   ```
   (Example assumes US-Eastern; adjust to your UTC offset.)

5. **Redeploy.** Then on your phone: Settings → **Phone Reminders → Enable reminders**,
   grant the notification permission.

## Notes
- When the flag is off, the Settings panel is hidden and the cron route no-ops.
- The reminder *logic* is unit-tested (`tests/push-reminders.test.ts`); the
  delivery path needs a real device + the keys above to verify end-to-end.
