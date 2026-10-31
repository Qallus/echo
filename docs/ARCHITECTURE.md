# Echo architecture

## Stack
- **App:** Next.js 16 (App Router, `src/`), React 19, shadcn/ui (Base UI), Tailwind 4. Deployed as a Docker image on Coolify.
- **Data/Auth/Storage:** Supabase. Server reads use the signed-in user's session, so Row Level Security decides access.
- **AI:** Vercel AI SDK with Anthropic, OpenAI, xAI and Moonshot (OpenAI-compatible). One streaming endpoint: `POST /api/chat`.

## Data model (supabase/migrations)
- `workspaces`, `workspace_members` (owner/admin/member). Each new user gets a personal workspace via a signup trigger.
- `folders`, `recordings` (source, status, duration, storage path, soft delete via `deleted_at`).
- AI output per recording: `transcript_segments`, `highlights`, `summaries` (one per recording), `action_items`.
- Storage bucket `recordings` (private). Object path: `<workspace_id>/<recording_id>/<file>`.
- Developer backlog: `dev_requests`, `dev_request_comments`. `mcp_audit_log` records every MCP tool call (clients can insert and read their own rows, never update or delete).
- `search_recordings(query, ws?, max_results?)`: full-text search over titles, transcripts and summaries; runs as the caller, so RLS applies.

## MCP connector
`/api/mcp` (Streamable HTTP, stateless, `@modelcontextprotocol/server`). Callers send a Supabase OAuth access token; every query runs with that token, so RLS is the boundary. Consent screen: `/oauth/consent`. Spec: `docs/MCP_CONNECTOR.md`.

## Account types and auth
- **Personal**: everyone's private space. **Business**: chosen at sign-up (`/signup`); the sign-up trigger also creates the company's Business workspace with the user as owner. **Team**: people invited into a Business (admin or member). **Super Admin**: app-wide, listed in `platform_admins` (add rows in the SQL editor only); sees `/admin` (read-only users and workspaces via `admin_list_users` / `admin_list_workspaces`).
- Sign in with email + password or an emailed link; Google when `NEXT_PUBLIC_GOOGLE_AUTH_ENABLED=true`. `/forgot-password` → email → `/reset-password`. `/settings`: name, email change (confirmed by email), password (asks for an emailed code when Supabase requires reauthentication), sign-in methods, sign out of all devices.

## Access rules
- Two kinds of workspace: **Personal** (one per user, created at sign-up, never has other members) and **Business** (`create_team_workspace`, shared with invited teammates). Business recordings are visible to every member; Personal ones only to their owner.
- Invites (`workspace_invites`): owners/admins of a Business workspace create an email-bound link (`/invite/<token>`, 14 days). `accept_workspace_invite` joins only if the signed-in email matches.
- Moving a recording between workspaces: only its creator or an owner/admin of its workspace, into a workspace they belong to; the folder is cleared. `created_by` can't change. A Business workspace always keeps one owner.
- A row is visible when the user is a member of its workspace. Child tables follow their recording.
- Members create and edit recordings. The creator or an owner/admin can hard-delete. Only owners manage members.
- Membership checks live in the non-exposed `private` schema.

## Build status
1. App shell, library, recording detail: done
2. AI model connections (Claude, ChatGPT, Grok, Kimi K3): done
3. Supabase auth, schema, RLS, storage bucket; pages on real data: done
4. Business/Personal workspaces, invites, bulk actions (move, folder, export, trash) and drag-and-drop: done
5. Echo MCP connector (docs/MCP_CONNECTOR.md): Phases 1–4 done (consent page, `/api/mcp`, 35 `echo_*` tools, `/developer` with connected apps and activity, `/backlog` with filters, drawer and comments). Phase 5 (Claude Code loop) once Echo is deployed
6. Recording capture, part A: done. Start dialog (choose Business or Personal first; mic, or mic + shared meeting tab), in-call panel (notes and flags saved as timestamped highlights, pause/stop/timer, level meter, first-run tips, pop-out via Document Picture-in-Picture), drag-and-drop or picker upload (50 MB per file on the current plan), audio stored at `<workspace>/<recording>/<file>` and moved with the recording, playback on the recording page. Part B done: transcription. `POST /api/transcribe` marks the recording `processing` and runs after the response (`after()`), as the user; starts automatically after recording/upload. Provider and model are a Super Admin choice on `/admin` (`platform_settings.transcription`): OpenAI `gpt-4o-transcribe-diarize` (speakers + timestamps; OpenAI shuts it down Feb 26, 2027) or `gpt-transcribe` (text only); Gemini planned. 25 MB per file; browser recordings use 32 kbps Opus (~1h40m). Failures are stored in `recordings.processing_error`
7. Then: Share. Share-link tab (public link; choose Audio/Transcript/Highlights/Summary; preview; copy/revoke) and Invite tab (named emails who sign in; people with access); a "Move to Business" prompt for team sharing
8. App pages done: Search (full-text with highlighted matches), Templates (summary templates in `src/lib/templates.ts`), Explore (available vs coming), Billing (trial plan and usage). Public marketing site done: `/` (landing) and `/pricing` in `src/app/(marketing)`; signed-in visitors to `/` see the app Home (`/home`) via a rewrite in `src/lib/supabase/proxy.ts`. Still needed before launch: privacy policy and terms (real legal copy)
9. Later: summary templates, AutoFlow rules, agents, Twilio calls/SMS, Resend email, API keys, super admin dashboard, billing
