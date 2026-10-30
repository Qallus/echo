# Echo

Record, transcribe and act on every call and meeting. Next.js 16 · React 19 · shadcn/ui · Tailwind 4 · Supabase · AI SDK (Claude, ChatGPT, Grok, Kimi K3).

## Run it in VS Code

1. Install **Node.js 22** (https://nodejs.org) if you don't have it.
2. Open this folder in VS Code (File > Open Folder).
3. Open the terminal (Ctrl + `) and run:
   ```
   npm install
   copy .env.example .env.local
   ```
4. Fill in `.env.local` (see below).
5. Run `npm run dev` and open http://localhost:3000.

## Supabase setup (one time)

1. **Database:** Supabase dashboard > SQL Editor > New query. Paste all of
   `supabase/migrations/20261029220000_initial_schema.sql` and click **Run**.
2. **Keys:** Project Settings > API Keys. Copy the **Publishable key** into
   `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`.
3. **Redirect URLs:** Authentication > URL Configuration.
   - Site URL: `https://echo.redial.si`
   - Redirect URLs: add `http://localhost:3000/auth/callback` and `https://echo.redial.si/auth/callback`
4. **Google sign-in (optional):** Authentication > Sign In / Providers > Google. Paste a Google OAuth
   client ID and secret. In Google Cloud, the authorized redirect URI is
   `https://wcsejeuqqeepgrprcrde.supabase.co/auth/v1/callback`.

5. **Branded emails:** create a personal access token at supabase.com/dashboard/account/tokens, add it to
   `.env.local` as `SUPABASE_ACCESS_TOKEN`, then run `npm run email:push`. This uploads the Echo versions of
   all 13 templates under Authentication > Emails: the 6 **Authentication** emails and the 7 **Security**
   emails. On the free plan this needs custom SMTP first. Edit them in `scripts/email-templates.mjs`;
   `npm run email:build` regenerates `supabase/templates/authentication/` and `security/` (named like the
   dashboard rows, listed in `index.json`) without uploading.

6. **Sign-in options:** email + password and emailed sign-in links work out of the box. For Google, enable it in
   Authentication > Sign In / Providers, then set `NEXT_PUBLIC_GOOGLE_AUTH_ENABLED=true` (build-time).
   Recommended: Authentication > Providers > Email: minimum password length 8 and **Secure password change** on.
7. **Super Admin:** in the SQL editor, run
   `insert into public.platform_admins (user_id) select id from auth.users where email = 'you@example.com';`

Email magic links work with no extra setup. After signing in, click **Load sample recordings** on Home to explore.

## Environment variables

| Name | Where | Notes |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase | `https://wcsejeuqqeepgrprcrde.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Supabase > API Keys | starts with `sb_publishable_` |
| `NEXT_PUBLIC_SITE_URL` | you | `http://localhost:3000` locally, `https://echo.redial.si` in production |
| `NEXT_PUBLIC_GOOGLE_AUTH_ENABLED` | you | `true` once Google is enabled in Supabase; otherwise the Google button is hidden |
| `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `XAI_API_KEY`, `MOONSHOT_API_KEY` | each provider | any missing model shows "no key" |

## Deploy on Coolify

New resource > this GitHub repo > build pack **Dockerfile**, port **3000**.
Add every variable above. Mark the `NEXT_PUBLIC_*` ones as **build-time** (they're baked into the browser bundle).

## Project layout

```
src/
  app/(app)/          signed-in pages: home, library, recordings, ask
  app/login, auth/    sign-in page, OAuth/magic-link callback, sign-out
  app/api/chat        streaming AI chat (auth required)
  components/         sidebar, tables, recording view, chat UI, shadcn/ui
  lib/data.ts         Supabase reads (RLS-scoped to the signed-in user)
  lib/actions.ts      server actions (folders, action items, sample data)
  lib/ai/             model registry, providers, prompt context
  proxy.ts            refreshes sessions, sends signed-out users to /login
supabase/migrations/  database schema, access rules, storage bucket
```
