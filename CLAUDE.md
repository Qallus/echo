@AGENTS.md

# Echo: guide for Claude Code

Echo records calls and meetings and turns them into transcripts, summaries, action items and AI chat. Owner: Jeremy Waters (Qallus LLC). Read `README.md` for setup and `docs/ARCHITECTURE.md` for the data model and build status.

## How Jeremy works
- **Approval-gated, one step at a time.** Propose the next step, build it, show what changed, then stop and wait for approval.
- Clean, functional code over clever or over-engineered code. Prefer small, readable files.
- Explain what to do in plain, numbered steps when he has to act (dashboard settings, env vars, deploys).

## Stack and conventions
- Next.js 16 App Router under `src/`, React 19, Tailwind 4, shadcn/ui on **Base UI**. Components use the `render` prop, not `asChild`.
- Supabase via `@supabase/ssr`: `src/lib/supabase/{server,client,proxy}.ts`. Session refresh and the login redirect live in `src/proxy.ts`.
- Reads go through `src/lib/data.ts`; writes through server actions in `src/lib/actions.ts`. Both use the signed-in user's client, so **RLS is the security boundary**. Don't use the service-role key in request paths. The one exception is `src/lib/supabase/admin.ts`, for routes with no user session that verify a shared secret or signature (`/api/notifications/deliver`, called by the database; `/api/webhooks/twilio/*` and `/api/webhooks/resend/inbound`, signed by Twilio and Resend; `/api/webhooks/redial/*`, signed by the voice gateway with `REDIAL_GATEWAY_SECRET`; `/api/cron/comms`, `CRON_SECRET`; `/unsubscribe`, a signed link), for `src/lib/secrets.ts` (read-only, only the encrypted `platform_secrets` table: service keys set in Admin → Settings → Integrations, falling back to the Coolify variable of the same name; read every key through `secret()` / `secrets()`, never `process.env` directly), and for Super Admin auth operations (invite, ban) in `src/lib/admin/actions/`, only after `requireStaff()` and a staff-checked database call that writes the audit log.
- Super Admin lives under `src/app/(admin)/admin`. Every page and action starts with `requireStaff(permission)` (`src/lib/admin/guard.ts`); the database re-checks with `private.staff_can()`, which requires an MFA-verified (aal2) session. Log every admin change (`adminAudit` or inside the SQL function).
- After any `npm install`/`uninstall`, run `npm run lock:linux` (needs Docker). npm on Windows drops Linux-only packages from the lock file and the Coolify build (`npm ci`) then fails.
- AI chat: `src/app/api/chat/route.ts` with `src/lib/ai/*` (Claude, ChatGPT, Grok, Kimi K3 via the AI SDK).
- Build with `npm run build` (webpack). Type-check with `npx tsc --noEmit`.

## Database changes
- Add a new file in `supabase/migrations/` named `YYYYMMDDHHMMSS_description.sql`. Never edit an applied migration.
- Every new table: explicit `grant`s, `enable row level security`, policies via `private.is_member` / `private.has_role` / `private.can_access_recording`. Use `(select auth.uid())` in policies.
- Helper functions that bypass RLS go in the `private` schema with `security definer set search_path = ''` and an `auth.uid()` check.
- Test RLS with two users (one per workspace) before shipping a migration.

## Developer backlog
Jeremy adds items from his phone through the Echo connector (`dev_requests` table). When the Echo MCP server is connected (`docs/MCP_CONNECTOR.md`), at the start of a session:
1. List open items (`echo_dev_request_list`, status new/planned).
2. Ask which to take on. When starting one, set it to `in_progress` and comment. When done, set `review` and comment with a summary and the commit hash.

## Current next steps
The full ordered list is in `docs/ARCHITECTURE.md` (Build status). In short:
1. Echo MCP connector: see `docs/MCP_CONNECTOR.md` (phases 1–2 done; 3–5 next).
2. Recording capture with the in-call panel and drag-and-drop upload to Supabase Storage (`recordings` bucket, path `<workspace_id>/<recording_id>/<file>`), then transcription jobs.
3. Share (link + invite), then the remaining app pages, then the public marketing site.
