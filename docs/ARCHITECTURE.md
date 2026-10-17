# Echo architecture / implementation backlog

## Product surfaces
- Standalone Echo: Next.js App Router + TypeScript dashboard, customizable brand and theme.
- Channel Cast and Redial: separate integration adapters; do not couple repositories directly.
- Storage: Supabase Auth + Postgres metadata + private object storage, with RLS and tenant isolation.
- Recording: consent-aware browser/mobile capture; durable uploads using signed URLs and asynchronous processing jobs.
- Transcription: provider abstraction; timestamped speaker turns where supported.
- AI: provider-agnostic summarization, follow-ups and action-item extraction, queued and auditable.
- Automation: trigger Paperclip-managed Hermes workflows using authenticated event/webhook endpoints.

## Suggested order of implementation
1. Auth, workspace and membership model, RLS and access tests.
2. Session CRUD, resumable uploads, consent and retention workflow.
3. Transcription background jobs and transcript editor.
4. Structured AI insights and task review/approval.
5. Calendar, CRM and agent integrations.
6. Theme/logo controls, billing and deployment hardening.

## Not included in this scaffold
Production authentication, completed shadcn/ui components, transcription, diarization, cloud recording storage, live conferencing, AI summaries, billing, automatic task execution, or deployed endpoints.
