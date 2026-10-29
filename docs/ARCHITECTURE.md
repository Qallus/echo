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

## Access rules
- A row is visible when the user is a member of its workspace. Child tables follow their recording.
- Members create and edit recordings. The creator or an owner/admin can hard-delete. Only owners manage members.
- Membership checks live in the non-exposed `private` schema.

## Build status
1. App shell, library, recording detail: done
2. AI model connections (Claude, ChatGPT, Grok, Kimi K3): done
3. Supabase auth, schema, RLS, storage bucket; pages on real data: done
4. Next: recording capture and upload to Storage, then transcription jobs
5. Then: summary generation with templates, AutoFlow rules, agents
6. Then: Twilio calls/SMS, Resend email, MCP access and API keys, super admin dashboard, billing
