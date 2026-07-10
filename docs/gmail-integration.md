# Gmail integration setup

LifeQuest supports an optional Gmail assistant connection. It can read a bounded inbox digest and create drafts for review. It does not automatically send email.

## 1. Configure Google Cloud

1. Create or select a Google Cloud project.
2. Enable the Gmail API.
3. Configure the OAuth consent screen and add the LifeQuest user as a test user while the app remains private/testing.
4. Create a Web application OAuth client.
5. Add these authorized redirect URIs:
   - `http://localhost:3000/api/integrations/gmail/callback`
   - `https://YOUR_DOMAIN/api/integrations/gmail/callback`
6. Copy the client id and secret into `GOOGLE_OAUTH_CLIENT_ID` and `GOOGLE_OAUTH_CLIENT_SECRET`.

LifeQuest requests `gmail.readonly` and `gmail.compose`. Google classifies broad Gmail scopes as restricted. Keep the app private/testing for personal use; publishing it broadly can require Google verification and, when restricted Gmail data is stored or transmitted by a server, a security assessment.

## 2. Configure Supabase

Run `supabase/gmail-integration.sql` in the Supabase SQL editor. The table has row-level security enabled, no browser policies, and revoked `anon`/`authenticated` privileges. Only authenticated server routes using the service role can access it.

Copy the server-only Supabase service role key into `SUPABASE_SERVICE_ROLE_KEY`. Never prefix this variable with `NEXT_PUBLIC_`.

## 3. Configure token encryption

Generate a high-entropy secret of at least 32 characters and set `INTEGRATION_ENCRYPTION_KEY`. Keep it stable: changing it makes existing encrypted refresh tokens unreadable, so users must reconnect Gmail after rotation.

## 4. Configure the deployment

Set these server variables in Vercel for Production and Preview:

- `GOOGLE_OAUTH_CLIENT_ID`
- `GOOGLE_OAUTH_CLIENT_SECRET`
- `SUPABASE_SERVICE_ROLE_KEY`
- `INTEGRATION_ENCRYPTION_KEY`

Set `APP_URL` to the canonical deployed origin if requests can arrive through multiple domains. Redeploy, open Settings → Gmail Assistant, and choose Connect Gmail.

## Security model

- OAuth state is signed, short-lived, and bound to an HttpOnly browser nonce.
- Google refresh tokens are encrypted with AES-256-GCM before database storage.
- Access tokens are refreshed server-side and never returned to the browser.
- Inbox access occurs only on explicit inbox actions or email-related Agent requests.
- Draft creation requires user confirmation; sending is intentionally unsupported.
- Disconnect attempts Google token revocation and removes the stored credential.
