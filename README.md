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
   - Site URL: your production URL (or `http://localhost:3000` for now)
   - Redirect URLs: add `http://localhost:3000/auth/callback` and `https://YOUR-DOMAIN/auth/callback`
4. **Google sign-in (optional):** Authentication > Sign In / Providers > Google. Paste a Google OAuth
   client ID and secret. In Google Cloud, the authorized redirect URI is
   `https://wcsejeuqqeepgrprcrde.supabase.co/auth/v1/callback`.

Email magic links work with no extra setup. After signing in, click **Load sample recordings** on Home to explore.

## Environment variables

| Name | Where | Notes |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase | `https://wcsejeuqqeepgrprcrde.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Supabase > API Keys | starts with `sb_publishable_` |
| `NEXT_PUBLIC_SITE_URL` | you | `http://localhost:3000` locally, your domain in production |
| `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `XAI_API_KEY`, `MOONSHOT_API_KEY` | each provider | any missing model shows "no key" |

## Deploy on Coolify

New resource > this GitHub repo > build pack **Dockerfile**, port **3000**.
Add every variable above. Mark the three `NEXT_PUBLIC_*` ones as **build-time** (they're baked into the browser bundle).

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
