# Redial first: homepage, plans, setup wizard and the automation MCP

Owner: Jeremy Waters (Qallus LLC). Written Nov 9, 2026. This is the working plan for three tracks that run in parallel, one approval-gated step at a time:

- **Track A:** a Redial-led homepage and separate Redial plans, so Redial is the product people get excited about and pay for.
- **Track B:** an 8-step Redial setup wizard after signup, whose answers flow into the user's dashboard and the Super Admin.
- **Track C:** one MCP that can run the whole business, from Claude, ChatGPT and the agent platform (Paperclip, Hermes, OpenClaw, Herdr).

## Where things stand (Nov 9)
- **Homepage** (`src/app/(marketing)/page.tsx`):
  - The hero already leads with Redial.
  - The first section after the hero is Echo's features, and the page metadata is Echo-first.
  - The workspace and Claude sections are Echo only.
- **Pricing:** Redial can only be bought as a $29/mo bolt-on on top of an Echo plan (`src/lib/billing/catalog.ts`). There's no standalone Redial plan.
- **Signup:** there is no onboarding on the web.
  - Signup is one form. `account_type` lives only in auth metadata.
  - Users without a Redial line get no Redial entry point: `/calls` returns 404 and the sidebar hides Calls.
- **Mobile setup:** the Redial mobile app has a setup flow (number with carrier forwarding codes, screening, assistant, notifications, test call) saved through `/api/mobile/rules.save`.
- **MCP:** works today at `/api/mcp`, with 51 `echo_*` tools (see `docs/MCP_CONNECTOR.md`).
  - Supabase OAuth 2.1; every call runs as the user under RLS.
  - Audit log, confirmations, daily caps.
  - Staff email tools only appear for staff with a two-step (aal2) session.
- **Reference only:** the old redial.si site and the ThePopOpp/redial repo. They're used for content and data (the carrier list, pricing ideas, the 8-step outline), not design.
  - The old form's weaknesses to avoid: it asks for acknowledgements more often than it delivers value, it has no business path, and it stores answers in JSON files.

## Decisions

| Topic | Decision |
|---|---|
| Pricing | Separate Redial plans, with Echo bundles. |
| Setup | An in-app setup wizard after a short signup. |
| Agent access | Hybrid: agents can do everything Jeremy can, with per-agent limits he controls in the dashboard. |
| Order of work | All three tracks in parallel, alternating steps. |
| Brand | The public site is **REDIAL**, using the same equalizer mark as Echo (lucide `AudioLines`). Echo stays the recording feature inside Redial. |
| Assistant | No house name (DJ retired Nov 10). Users name their assistant; suggested Ara, Rex, Eve, Leo, each matching a voice. The site rotates through them. New lines default to Ara. |

---

## The assistant's name: DJ
- **Hero demo and marketing copy:** "Ava" becomes "DJ" (`hero-demo/redial-scenes.tsx`, the homepage sections, the FAQ).
  - Example greeting: "Hi, this is DJ, Jordan's assistant. Who's calling, and what's it about?"
- **New lines:** a migration changes the `redial_lines.assistant_name` default from `'Echo'` to `'DJ'`. Lines still on the old default are updated; names people chose are left alone.
- **Defaults elsewhere:**
  - the mobile setup's fallback greeting (`mobile/src/app/setup/assistant.tsx`);
  - the line settings placeholder (`src/components/redial/line-settings.tsx`);
  - the setup wizard's assistant step.

---

## Track A: a Redial-led homepage and Redial plans

### A1. Homepage below the hero
Each section is a small component in `src/components/marketing/home/`. In order:

1. **The problem.** Spam, sales calls and the one call that matters all ring the same, so you either answer everything or miss what's important.
   - Three short cards: Spam · Missed opportunities · Interrupted focus.
   - No made-up statistics.
2. **How Redial handles a call.** Ring → DJ answers → you see who and why → you decide.
   - Scroll-stepped, reusing the hero phone scenes (`DeviceDemo` with `phone`).
3. **Live call controls.** Tabs for Insider (listen), Audible (guide), Gavel (take over), Directory (transfer) and Mirror (assist). Each tab plays its phone scene with a one-line benefit.
   - Names come from `src/lib/redial/features.ts`.
4. **For you / for your business.**
   - **Personal:** family on your VIP list always gets through, spam never rings, callbacks get booked.
   - **Business:** never miss a lead after hours, DJ knows your services and hours, calls go to the right teammate, and every call is summarized for the team.
5. **Keep your number.** Forward the calls you miss, or get a Redial number.
   - A carrier strip (T-Mobile, AT&T, Verizon and more) linking to `/compatibility`.
6. **Every call becomes notes.** Echo as part of Redial: recording, transcript, summary and Ask Echo on every call. Then a short block on Echo for meetings.
7. **Pricing preview.** Three Redial plan cards from the catalog, "Start free", and a link to `/pricing`.
8. **Trust and control.**
   - You choose how DJ introduces itself.
   - Opt-outs are honored, your data is yours, and nothing is shared without you.
9. The existing mobile app section, a Redial-first FAQ, and a final call to action.

**Also in this step**
- Redial-first metadata.
- The header and footer brand becomes REDIAL with the equalizer mark. The equalizer also replaces the phone icon where it stands for Redial: the hero toggle, the mega menu, the app card, and the email header logos (`public/email/logos/redial-*.png`).
- New pages:
  - `/compatibility`: carriers and forwarding instructions, from one shared carrier file.
  - `/redial/business`: business landing page.
  - `/redial/personal`: later.

**Ideas to build excitement, in order of payoff**
1. **"Call DJ yourself."** A public demo number answered by the real assistant with a demo persona.
   - Rate-limited per caller and capped per day.
   - Uses the existing Twilio and voice-gateway path with a demo line.
   - At the end it offers to text a start-free link, only if the caller agrees, with STOP honored.
2. **A free plan that works immediately:** forward the calls you miss and get rule-based screening and summaries.
3. **Industry pages** (contractors, real estate, clinics, salons) from one template.
4. **Referral credit:** give a month, get a month.
5. **A factual comparison page:** Redial versus voicemail and versus the phone's built-in screening.
6. **A waitlist launch campaign** with the new scheduled email and texts, following each person's chosen frequency.

### A2. Separate Redial plans
Plans are in the database catalog, and Jeremy sets the prices in Admin → Billing.

- **Database changes:**
  - Migration: `catalog_products.product_line` (`'echo'` or `'redial'`).
  - One active plan subscription per product line, so someone can hold a Redial plan and an Echo plan.
  - Redial entitlements come from the plan's screening minutes (`meter: "redial"`).
- **Suggested starting prices (Jeremy confirms):**

| Plan | Price | Includes |
|---|---|---|
| Redial Free | $0 | 1 line, forward what you miss, rule-based screening (VIP and block lists), 10 AI minutes, summaries |
| Redial Personal | $12/mo, $120/yr | 100 AI minutes, live call controls, callbacks, Echo Free included |
| Redial Business | $29 per line/mo, $290/yr | 300 AI minutes, business knowledge for DJ, Directory transfers, shared line, summaries ready for the CRM |
| Redial Team | $69/mo | 5 lines sharing 1,000 AI minutes, priority support |
| Redial Business + Echo Pro | Bundle price | |

- The current Redial bolt-on maps to Redial Business, so existing buyers aren't affected.
- **`/pricing`:** a product switcher, with Redial first and Echo second.
- **Checkout:** keeps `startCheckout` and the Stripe webhook.
- **Files:** `src/lib/billing/catalog.ts`, `catalog-server.ts`, `src/components/store/store.tsx`, `src/app/(marketing)/pricing/page.tsx`, the Stripe webhook route.

---

## Track B: the Redial setup wizard (8 steps, after signup)

**Flow**
- Signup stays short: name, email, password, Personal or Business.
- `account_type` is saved in a new `profiles.account_type` column, set by `private.handle_new_user`.
- People then land on `/setup` (`src/app/(app)/setup/[step]`).
- Every step saves as you go, can be skipped, and can be picked up again from the dashboard.

| Step | What it asks |
|---|---|
| 1. About you | Name; mobile number, checked with a 6-digit text code; Personal or Business. Business also asks for company, team size, industry and website. |
| 2. Your phone | Carrier (T-Mobile, AT&T, Verizon, Mint, Boost, Cricket, Metro, Visible, Google Fi, US Mobile, Consumer Cellular, Spectrum, Xfinity, Straight Talk, Tracfone, Other / not sure). Device: iPhone, Android, desk phone or VoIP app. Line type: mobile, landline, or a VoIP provider such as RingCentral. |
| 3. How calls reach Redial | Keep your number and forward what you miss (busy, no answer, unreachable), forward everything, or get a Redial number. Shows the right codes for your carrier, from `src/lib/redial/carriers.ts`, which the mobile app also uses. |
| 4. Who gets screened | Unknown callers, everyone, or off. Business hours for Business accounts. VIP and block numbers. |
| 5. Your assistant | Name (DJ by default), voice, greeting. How DJ introduces itself is the user's choice. Business accounts add services, hours and common questions, which become the line's "about". |
| 6. After the call | Where DJ rings you; checked so it can't loop back to the forwarded phone. Alerts by push, text or email. Callbacks on or off. Directory: teammates or numbers to transfer to (Business). |
| 7. Choose a plan | Redial plans from the catalog. Free is the default; paid plans go through checkout. |
| 8. Review and test | Every answer on one page. Terms, plus text-message consent where the person picks how often. A readiness checklist (account, number, route, assistant, alerts) and a "Call your Redial number now" test call. |

**Data**
- New table `redial_setups`:
  - Columns: `user_id` (primary key), `step`, `answers` (jsonb, validated by one zod schema in `src/lib/redial/setup.ts`), `status` (draft, submitted, active, needs_info), `line_id`, timestamps.
  - RLS: the owner can read and write it. Staff can read it with `users.view`. Explicit grants and an RLS test.

**Where the answers go**
- **User dashboard:**
  - `/home` shows a "Finish setting up Redial" readiness card at the top.
  - The sidebar always shows Calls. Without a line it opens `/setup` instead of a 404.
  - `/calls` line settings are filled in from the answers.
  - Profile fields go to `profiles` and `details`.
- **Super Admin:**
  - A "Setup requests" queue in Admin → Redial with all the answers. "Assign number" uses one of Echo's own Twilio numbers (`admin_redial_assign`).
  - Each submission creates or updates a CRM contact (lead source "redial_setup"). Business accounts also get a pipeline deal.
- **When a number is assigned:** the answers are written to the line (mode, assistant, greeting, about, ring number) and its VIP and block lists.
- **Mobile:** new mobile API actions `setup.get` and `setup.save`, so the app's setup flow uses the same record.

---

## Track C: the Redial automation MCP

### Shape
- **One endpoint**, extending today's `/api/mcp` (`src/lib/mcp/*`). Claude, ChatGPT (remote MCP with OAuth) and the agent harnesses all connect to it.
- **Naming:** existing `echo_*` tools keep their names. New tools are named `<domain>_<action>`.
- **Registry-driven CRUD:**
  - `src/lib/mcp/registry.ts` declares each resource once: table or view, schema, filters, permission, soft-delete column, risk level.
  - Generic tools serve every resource: `resource_list`, `resource_get`, `resource_create`, `resource_update`, `resource_delete`, `resource_restore`.
  - Side effects get their own tools: send, call, publish, refund, assign, run.
  - `tool_search` lets a client find tools by domain or keyword, so it never has to load hundreds of tools.
- **Risk levels:**
  - **read:** runs immediately.
  - **write:** runs and is audited.
  - **high:** returns a preview and a confirmation id, and runs only after `confirm_action`. High covers bulk sends, deletes, refunds, suspensions, publishing, secrets and deploys.
  - This is the same pattern as today's `email_send_prepare` / `email_send_confirm`.
- **Safety:**
  - Deletes are soft (trash or restore) wherever the table supports it.
  - Inbound email, text and transcript content is returned marked as untrusted.
  - Secrets can be set (write-only, high risk) but never read.

### Access: hybrid
**People** keep the Supabase OAuth connector. First, check whether OAuth tokens carry the two-step (aal2) claim. If they don't, add a one-time "connector staff grant":
- Jeremy approves a client in Admin with two-step sign-in.
- It's stored in `mcp_staff_grants(client_id, user_id, permissions, expires_at)`.
- `private.staff_can` honors it.

**Agents** (Paperclip, Hermes, OpenClaw, Herdr, ChatGPT automations):
- **Account:** each agent is a real user marked as an agent in `platform_staff` (new role `agent`), created and owned by Jeremy in Admin → AI → Agents.
- **Key:** each agent gets an API key, stored hashed and shown once.
  - The MCP exchanges the key for a short-lived (about 10 minute) token for that agent user, signed with a dedicated signing key registered in Supabase. RLS stays the security boundary, and no service-role key is used.
  - This gets a spike first. The fallback is a per-agent session refreshed on the server.
- **Capability:** an agent can have everything Jeremy can do, or a subset.
- **Limits, set in the dashboard and enforced in the tool layer and in SQL (`agent_policies`):**
  - allowed domains and tools, read-only switch;
  - daily caps for emails, texts, calls, AI minutes, spend and deletes;
  - tools that always need a person's approval;
  - working hours, IP allowlist, expiry;
  - pause and kill switch.
- **Approvals inbox** in Admin → AI → Agents, with a push and text alert to Jeremy. The agent checks `confirm_status` until someone approves or declines.
- **Audit:** every call is logged with the agent's id (`mcp_audit_log`). Admin changes also go to `admin_audit_log`.
- **Rate limits** move from in-memory counters to the database.

### Tool catalog by phase
Each phase includes any migrations, the tools, an RLS test, a smoke test and docs. **R/W/H** = read / write / high (preview and confirm).

**Phase 1: foundation**
- `tool_search` (R)
- `confirm_action` (H), `confirm_status` (R)
- `resource_list`, `resource_get` (R)
- `resource_create`, `resource_update` (W)
- `resource_delete` (H), `resource_restore` (W)
- `agent_whoami` (R)
- Admin UI: agents, keys, limits, approvals
- The aal2 fix

**Phase 2: admin CRM and operations** (registry resources plus a few actions). **Done** (Nov 9). Built as resources `contact`, `company`, `deal`, `activity`, `booking_type`, `booking`, `event`, `event_registration`, `plan`, `plan_task`, `workspace_doc`, `workspace_comment`, `doc_folder`, `document`, `business_card`, `card_lead`, `waitlist_entry`, `saved_report`, plus `crm_deal_checklist` and `crm_deal_step_set` (so agents can clear a stage's Next Steps), `plans_create`, `plan_get` and `document_link`. Plan groups are read through `plan_get`; document uploads stay in the dashboard.
- Resources: contacts, companies, leads, deals, pipeline stages, clients, booking types, bookings, events, plans, plan tasks, workspace docs and comments, documents and folders, business cards and card leads, waitlist entries, saved reports.
- Actions:
  - `crm_lead_convert` (W): lead to deal
  - `crm_deal_move_stage` (W): follows the stage checklist
  - `crm_import_contacts` (H)
  - `bookings_confirm` (W), `bookings_cancel` (W)
  - `reports_run` (R)
  - `analytics_series` (R)
  - `waitlist_export` (R)

**Phase 3: communications**
- Inbox:
  - `inbox_list`, `inbox_get` (R)
  - `inbox_reply` (W)
  - `inbox_assign` (W)
  - `inbox_convert` (W): to a contact, lead or deal
- Texts:
  - `sms_thread_list`, `sms_thread_get` (R)
  - `sms_send` (W, one person)
  - `sms_schedule` (W)
  - `sms_bulk_prepare` / `confirm_action` (H): waitlist texts follow each person's frequency
- Calls:
  - `call_list`, `call_get` (R)
  - `call_recording_url` (R, signed)
  - `call_summarize` (W)
  - `call_place` (H)
- Email: today's 12 email tools, plus template create, update and delete through the registry.
- Notifications:
  - `notification_deliveries_list` (R)
  - `notification_test` (W)
  - `notification_announce` (H)
- Automation:
  - rules as registry resources
  - `automation_run_now` (H)
  - `automation_runs_list` (R)

**Phase 4: Redial and the platform**
- Redial lines:
  - `redial_line_list`, `redial_line_get` (R)
  - `redial_line_assign` (H)
  - `redial_line_update` (W): rules, assistant, greeting, about
  - `redial_routing_set` (H)
- Lists and directory:
  - `redial_list_add`, `redial_list_remove` (W)
  - `redial_directory_*` (W)
- Calls and callbacks: `redial_call_list` (R), `redial_callback_*` (W)
- Live calls (only on lines the caller may manage): `redial_live_guide` (W), `redial_live_transfer` (H)
- Setup requests: `redial_setup_list` (R), `redial_setup_update_status` (W)
- Users:
  - `user_list`, `user_get` (R)
  - `user_invite` (W)
  - `user_suspend`, `user_restore`, `user_set_role` (H)
- Billing:
  - catalog products and prices as registry resources (H for price changes)
  - `orders_list`, `orders_get` (R)
  - `order_refund` (H)
  - `subscription_list` (R)
- AI:
  - `ai_usage` (R)
  - `ai_settings_update` (W)
  - `ai_provider_*` (W)
- Settings:
  - `settings_get`, `settings_update` (W)
  - `integration_status` (R)
  - `secret_set` (H, write-only)

**Phase 5: the user dashboard**
- Today's recording, transcript, summary, folder, highlight and action-item tools.
- Calendar events, summary designs and templates, shared-with-me, library moves and trash.
- Backlog (today's tools), developer grants (`grant_list` R, `grant_revoke` H).
- Team: `team_invite` (W), `team_remove` (H).
- `billing_portal_link` (R), orders (R).
- The user's own Redial calls, rules and lists.

**Phase 6: content and marketing**
- Marketing pages are code today. First a small CMS: `site_pages` and `site_blocks` with draft, preview and publish. The homepage sections read from it.
- Content tools:
  - `site_page_*` (W)
  - `site_page_publish` (H)
  - `landing_page_create_from_template` (W)
- Social:
  - accounts and posts: `social_post_create` (W), `social_post_schedule` (W), `social_post_publish` (H)
  - LinkedIn and Meta once their app reviews pass.
- New dashboard features:
  - Requests go through `dev_requests`, then the Claude Code backlog loop.
  - `deploy_trigger` (H) and `deploy_status` (R) call the Coolify API.

**Phase 7: telephony and outside services**
- Twilio: `twilio_numbers_list` (R), message and call history, call placement (H).
- Server-side connectors for automations that agents and rules run:
  - Slack: notify, and answer approvals in Slack.
  - Google Workspace (per-user OAuth): Gmail, Calendar for bookings, Drive, Docs, Sheets, Slides.
  - Microsoft 365 / Outlook (Graph).
  - Hostinger (DNS and mail), Coolify, xAI, and Firestore if it's used.
- In Claude itself, use the official Gmail, Calendar, Drive and Slack connectors rather than rebuilding them.

**Phase 8: the agent platform**
- **Outbound events:** webhook subscriptions with signed deliveries, plus `events_poll` (R). Events: new lead, missed call, inbound text or email, setup submitted, payment received, and so on, so agents can react.
- **Hosting:**
  - Paperclip (paperclip.redial.si) orchestrates.
  - Hermes (hermes.redial.si), OpenClaw (openclaw.redial.si) and Herdr run on Coolify (agents.redial.si).
  - Each has its own agent key and limits.
- **ChatGPT:** an OpenAI connector config, using the same endpoint with OAuth.

**Phase 9: developer API and Chrome extension**
- Public REST `/api/v1` (already advertised on the Developers page), using the same keys and registry.
- A Chrome extension (Manifest V3): click to call, screen a number, save a page to Echo.
- Desktop surfaces, signed in with user tokens like the mobile API.

**Files**
- Core: `src/lib/mcp/{server,registry,auth,audit,agents,confirm}.ts`, `src/lib/mcp/tools/<domain>.ts`, `src/app/api/mcp/route.ts`.
- Agent admin: `src/app/(admin)/admin/ai/agents/*`.
- Docs: `docs/MCP_CONNECTOR.md`, plus a new `docs/AGENTS.md` (keys, limits, harness setup).

---

## Track D: Redial phone service (home and business)
Redial as a full phone line: Redial Home Phone (landline replacement) and Redial Business Phone (desk phones and extensions), with DJ screening built in. Desk, cordless and Wi-Fi SIP phones (Grandstream WP826, Yealink, Poly) register to a Twilio SIP Domain and set themselves up.

- **P1 (done):** `/home-phone` and `/business-phone` pages (drawn phones, how it works, supported phones, comparison tables, plan comparison, 911 notice, FAQ topic `phones`); `catalog_products.phones` and the two phone plans; a Phone service row on `/pricing`; nav, footer and `/compatibility` links. Supported phones live in `src/lib/redial/phone-models.ts`.
- **P2:** `redial_devices`, the SIP Domain and credentials (`src/lib/comms/sip.ts`), a Phones tab in Calls, the auto-setup route `/api/provision/[token]/[file]`, and desk phones ringing with the mobile in `ringOwner()`.
- **P3:** calling out from desk phones (`twilio/redial/sip`), 911 addresses registered with Twilio (required before phone service starts), number porting requests, and wizard hooks.

## Order of work
Steps alternate A → B → C. Each one is built, checked, committed and pushed, then waits for approval.

1. **Done:** this plan.
2. **A1a:** homepage sections 1–4, Redial-first metadata, REDIAL brand with the equalizer mark, DJ as the assistant name.
3. **B1:** `profiles.account_type`, the `redial_setups` table and RLS test, setup steps 1–3.
4. **C1a:** registry engine, risk levels and `confirm_action`, plus the aal2 check.
5. **A2:** Redial plans in the catalog and on `/pricing`.
6. **B2:** setup steps 4–8, the home readiness card, Calls always in the sidebar, the admin setup queue.
7. **C1b:** agent accounts, keys, limits and the approvals inbox.

Then:
- A1b: the remaining homepage sections, `/compatibility`, `/redial/business`, the "Call DJ yourself" line.
- MCP phases 2–9, alternating with homepage and onboarding follow-ups. Phase 2 is done.

## How each step is checked
- **Code:** type-check, lint and a production build. After any package change, `npm run lock:linux`.
- **Database:** RLS tests through Supabase MCP. Cases: customer, other customer, staff without two-step, staff with two-step, agent with limits, revoked agent.
- **Visual:** screenshots at desktop and phone widths, light and dark.
- **Setup wizard, end to end:** a test signup on localhost through all 8 steps, then check:
  - the setup row;
  - the CRM contact;
  - the admin queue entry;
  - the home readiness card;
  - assigning a number fills in the line;
  - the mobile app reads the same answers.
- **MCP:**
  - the existing smoke test, plus an agent-key smoke test: search, read, write, and a high action (preview, approve in the dashboard, runs);
  - going over a limit returns a plain refusal;
  - every call shows in the audit log.
- **Jeremy's checks:** connect from Claude and from ChatGPT, and one Paperclip agent with a read-only key.
