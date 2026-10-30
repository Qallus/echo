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
5. Next: Echo MCP connector (docs/MCP_CONNECTOR.md). Phases 1–2 done (consent page, `/api/mcp`, `echo_whoami`); then Phase 3 tools, Phase 4 `/developer` + `/backlog`, Phase 5 Claude Code loop
6. Then: recording capture. In-call panel (always-on-top via Document Picture-in-Picture where supported): choose Business or Personal at Start and show it in the header; notes and a flag button saved as timestamped highlights; pause/stop/timer; first-run tips. Plus browser recording, drag-and-drop audio upload, upload to Storage, transcription jobs
7. Then: Share. Share-link tab (public link; choose Audio/Transcript/Highlights/Summary; preview; copy/revoke) and Invite tab (named emails who sign in; people with access); a "Move to Business" prompt for team sharing
8. Then: remaining app pages (Search, Templates, Explore, Billing), then the public marketing site
9. Later: summary templates, AutoFlow rules, agents, Twilio calls/SMS, Resend email, API keys, super admin dashboard, billing
