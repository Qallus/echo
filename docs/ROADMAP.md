# Echo roadmap: from recorder to platform

Updated Nov 2, 2026. Each step still goes through the usual approve → build → review loop.

**Goal:** a feature-rich, paid platform. People record and understand conversations, including phone calls, share them in any format, and pipe the data into the tools they already use. Echo is sold through plans, seats, bolt-ons, minute packs and partners.

| Phase | What | Status |
|---|---|---|
| 1 | Core product: profiles, notifications, store, templates, Summary Builder | **Done** |
| 2 | Super Admin control center (S1–S5) | **Next** |
| 3 | Customers' own AI keys (ships with S3) | Planned |
| 4 | Echo call line + Redial module | Planned |
| 5 | Native app (Capacitor), Android first | Planned |
| 6 | Connectors | Planned |
| 7 | Business and client integrations | Waiting on the detailed list |
| 8 | AI-ready exports | Planned |
| 9 | Share, affiliates, API and webhooks, blog and SEO | Planned |

---

## Phase 1: Core product (done)
- **Profiles:**
  - photo, name, title, company, phone with a privacy switch, time zone, bio and links
  - additional fields (prefix, more phones and emails, address, custom fields), each private or shared with teammates
  - hover cards wherever a person appears
- **Notifications:**
  - live bell (Realtime)
  - email (Resend), SMS (Twilio, verified numbers), web push
  - preferences grid and quiet hours
  - delivery log
- **Store (Stripe):**
  - plans (Pro, plus Business per seat with graduated tiers), bolt-ons, minute packs and services
  - cart, checkout, thank-you page, orders and receipts, order emails
  - Terms, Privacy and Developers pages
- **AI:**
  - Ask Echo with Claude, ChatGPT, Gemini, Grok, Kimi and OpenRouter
  - summaries and highlights from 86 templates in 17 categories
  - Summary Builder (branded summary designs), also available to Claude through the MCP connector
- **Recording:**
  - in-browser recorder with a pop-out panel, notes and flags
  - silence warning
  - upload, transcription with timestamped segments, "Transcribe again"

**Still open from Phase 1:** verify the `redial.si` sending domain in Resend; rotate `NOTIFY_SECRET` before launch.

---

## Phase 2: Super Admin control center
Modelled on the Channel-Cast-OS admin layout: nav groups **Main** (Dashboard, Analytics, Communications, Bookings, Contacts, Pipeline, Projects, Plans, Workspace, Reports), **Operations** (Clients, Business Cards, Billing, Documents, Automation, AI) and **Account** (Profile, User Management, Team, Settings, Logout).
- Reuse Channel-Cast-OS's UI patterns and record shapes, **not** its data layer: it uses the service role everywhere, decides admins by an email list, and runs on mock data.
- In Echo, everything goes through security-definer functions guarded by staff permissions, and every action is written to an audit log.

**Decisions:**
- **Staff roles:** owner, admin, support, finance, marketing, analyst. Two-step sign-in (MFA) is required.
- The CRM and ERP sections are an **internal back office**: Qallus runs the Echo business with them, and customers don't see them. They could become a paid customer bolt-on later.
- **Local models:** any OpenAI-compatible endpoint, such as Ollama, vLLM or LM Studio on Jeremy's server, is added as a custom provider. Super Admin compares quality, speed and cost to find what gives the best results.
- **Auth-admin operations** (invite, suspend, sign out everywhere, delete) may use the service-role client, but only inside Super Admin actions, after a staff permission check plus MFA, and each one is audited.

**Build steps:**

| Step | Builds |
|---|---|
| **S1. Foundation** | Admin shell and navigation; `platform_staff` roles and permissions; MFA; `admin_audit_log`; dashboard with real KPIs and a "Needs attention" list |
| **S2. Users and workspaces** | Search and filters; Customer 360 (profile, workspaces, plan, orders, usage, audit trail; no transcript content); invite, suspend/restore, sign out everywhere, staff roles, workspace ownership |
| **S3. AI models and keys** | Enabled providers and models, defaults and fallback order; custom and local providers; transcription settings; usage and cost per workspace, model and feature; customer key status; MCP usage |
| **S4. Pricing and billing** | Catalog moves from code into the database (products, prices, entitlements, pricing rules); price edits create new Stripe Prices; discount for customers' own keys; bolt-ons; coupons; orders and refunds; subscriptions; MRR, ARR and churn; failed payments; per-minute metering against plan minutes and packs |
| **S5. CRM back office** | Contacts, Clients, Pipeline → Bookings, Projects, Plans → Documents and Workspace → Business Cards → Automation and Communications → Analytics, Reports, Team and Settings |

Later admin sections:
- **Marketing and web content:** blog and pages CMS (Phase 9)
- **Notifications:** templates and provider health
- **Affiliates**
- **API:** keys and webhook deliveries
- **Feature flags, rate limits and maintenance banner**

---

## Phase 3: Customers' own AI keys
- **Where:** Settings → AI models. Customers add keys for Claude, ChatGPT, Gemini, Grok, Kimi or OpenRouter, test them, and choose models.
- **Scope:** the workspace owner chooses **workspace** (one set of keys for the team) or **per person**.
- **Fallback:** if a customer's key fails, Echo **falls back to its own keys**. The fallback is logged, and the owner is notified once a day.
- **Transcription:** a customer's own OpenAI key also covers transcription.
- **Model choice:** customers choose in their dashboard when they've added their own keys. Super Admin sets the defaults and which models are available.
- **Pricing:** customers using their own keys can get a discount, set in Super Admin (S4).
- **Security:**
  - keys are encrypted on the server (AES-256-GCM, with `AI_KEYS_SECRET` held in Coolify)
  - the database stores only scrambled text and the last 4 characters
  - full keys are never shown again
- **Usage:** every AI call records provider, model, tokens or audio seconds, estimated cost, and whose key was used.
- **"Running off their AI subscriptions":** ChatGPT and Claude plans can't be used by other apps. They work the other way round: users connect Echo to their Claude through the **Echo MCP connector**, which is already live.

---

## Phase 4: Echo call line + Redial module
Redial (the AI call-screening product in `docs/REDIAL_COMPLETE_PROJECT_HANDOFF_v1.1.zip`) is **built inside Echo**: same users, security model and Super Admin. It uses **Stripe**, not the kit's Square, so the kit's Square sections don't apply.

### 4a. Call line (Twilio, on Jeremy's spare Echo number)
- **Outbound "Call & record":**
  1. Tap a contact in the app or dashboard.
  2. Twilio rings your phone first, then connects the other person.
  3. They see **your own cell number** (Twilio verified caller ID; each user verifies their number once).
  4. Each side is recorded on its own channel.
- **Inbound and any other call:** answer on your normal number, then tap **Record this call**. The Echo line is merged in. No new number to hand out.
- **Workspace:** recordings go to the user's default workspace from Settings. Outbound calls can also offer "press 1 for Personal, 2 for Business"; only the user hears it.
- **No automated announcements.** Announcing is the user's responsibility, verbally or with an optional announcement users can turn on from the dashboard. Arizona needs only one person's consent; the Terms say users must follow the law where they and the other person are.
- **After the call:** saved, transcribed and summarized automatically. Twilio's copy is deleted, and minutes are logged.
- **Who can use the line:** only users with a verified cell number.
- **Billing:** per minute, counted against plan minutes, with minute packs.

### 4b. Redial AI screening
- Twilio Media Streams through a separate `voice-gateway` container on Coolify, with xAI realtime voice.
- Screening modes (spam only, unknown callers, all), VIP override, rules with a simulator, a callback inbox and block/allow lists.
- Built on the kit's conference-first call setup (kit docs `06`, `21`).

### 4c. Live call controls
**Insider** (listen silently), then **Gavel** (take over from the AI), then **Audible** (private guidance to the AI), then **Directory** (transfers). Specs are in kit docs `19` and `20`. Each control has its own permission, feature flag and kill switch.

---

## Phase 5: Native app (Capacitor)
- **Approach:** wraps the Echo web app, so new features ship to web and mobile together. Native plugins add:
  - **Record this call:** on Android, with Echo set as the default phone app, it merges the call itself in one tap. On iPhone it's one tap, then **Merge Calls**, the most Apple allows.
  - recording in the background for meetings
  - push notifications
  - "Share to Echo" for audio files and voice memos
- **Order:** Google Play first; Jeremy is opening the developer account. The App Store follows once the Apple Developer account is active later this month.
- Calls rely on the Phase 4a call line.

---

## Phase 6: Connectors
- **Google:** Gmail, Drive, Docs, Sheets, Slides, Chat, Meet, Calendar.
- **Microsoft 365:** Teams, Outlook, OneDrive, Word, Excel.
- **Apple:** Calendar, Contacts, Notes, where Apple allows.
- **Collaboration:** Slack, Zoom, Notion.
- **CRMs:** Salesforce, HubSpot, Pipedrive, GoHighLevel. Summaries, action items and call logs land on the contact or deal.
- **Meeting bot:** joins Zoom, Meet and Teams from the calendar and records automatically, through a provider such as Recall.ai.
- **No-code:** Zapier, Make, n8n.

## Phase 7: Business and client integrations
- **Jeremy's businesses:** Channel Cast, Control-P, Qallus, Redial, Smarty Kiddo.
- **Clients:** Strategic Income Group, MJG, Constructed Matters, CFS, Paramount Painting.
- **What connects:** shared sign-in, data both ways, cross-sell. Defined per business once Jeremy's detailed list arrives.

## Phase 8: AI-ready exports
- **AI-ready Markdown:**
  - a clean structure with headings, timestamps, speakers, decisions and action items
  - made to drop into VS Code, Cursor or any AI coding editor
- **Code-ready exports:** HTML, CSS, JavaScript, React and Next.js versions of a summary or report, so a frontier model can turn them into designs, pages or code.

---

## Phase 9: Share, affiliates, API, blog and SEO
### Share
- **What:** audio, transcript, highlights, summary, action items, or a full report.
- **Formats:** public link, branded PDF (with a QR code linking to the audio), embed, HTML file, DOCX, TXT, SRT/VTT captions, Markdown.
- **How:**
  - copy a link
  - invite people (Echo users get access; others get a link)
  - email or SMS
  - send to an integration
- **Link options:** expiry date, password, allow download, hide speaker names, view analytics.

### Referrals and affiliates
- Personal invite links with rewards for both sides, applied as Stripe coupons.
- **Partner program:** applications approved in Super Admin, a code and link per partner, commission rates, a dashboard, and payouts (manual first, Stripe Connect later).

### Echo API and webhooks
- **REST API:** workspace API keys with scopes, covering recordings, transcripts, summaries, action items, search and upload.
- **Webhooks:** signed, with retries and a delivery log. Events: `recording.created`, `transcript.ready`, `summary.ready`, `action_item.created`, `share.viewed`.
- **For developers:** an OpenAPI spec, docs, a JavaScript SDK, and rate limits per plan. The Developers page already documents the planned API.
- **Other paid bolt-ons:** translation, custom vocabulary and speaker recognition, white-label, a compliance pack (HIPAA BAA, data retention rules), and hardware import (Plaud and voice memos).

### Marketing site, blog and SEO
- **Blog:** edited in Super Admin, with scheduled publishing and preview links.
- **SEO:** sitemap, robots.txt, canonical URLs, Open Graph images, structured data, RSS, Core Web Vitals.
- **Search pages built from data:** use cases, integrations, the public template gallery, comparisons.
- **Before launch:** About, Contact/Support and Security pages, plus the launch safeguards Jeremy will call for.

---

## Decisions log
- **Billing:** Stripe, for Echo and the Redial module.
- **Customers' own AI keys:** workspace or per person, chosen by the owner. Falls back to Echo's keys. A customer's OpenAI key covers transcription. Customers choose models when they use their own keys; Super Admin sets defaults.
- **Call line:**
  - inbound and outbound, on a spare Twilio number
  - outbound shows the user's own cell number
  - no automated announcements
  - default workspace, or press 1 or 2
  - billed per minute, with packs
- **Native app:** Capacitor, Android first.
- **Super Admin:** staff roles with MFA; the CRM is an internal back office; any OpenAI-compatible local model can be added.

## Open items
1. Jeremy's detailed list of businesses, clients and integrations (Phase 7).
2. Final plan prices and limits (the store has placeholders).
3. The Twilio number for the call line, and A2P 10DLC registration status for SMS.
4. Affiliates: build in-house (the default, in Super Admin) or use Rewardful/FirstPromoter.
5. Meeting bot provider (Recall.ai or similar).
