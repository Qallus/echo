# Echo roadmap: from recorder to platform

Draft game plan for review (Oct 30, 2026). Nothing here is built yet. Each phase ends with something usable, and each step still goes through the usual approve → build → review loop.

**Goal:** a feature-rich, paid platform. People record and understand conversations, share them in any format, and pipe the data into the tools they already use. Echo is sold through plans, seats, bolt-ons and partners, and found through search.

---

## Phase 1: People, notifications and sharing (core product)

### 1.1 Profiles (shadcn-style)
- **Profile fields:** photo, full name, job title, company, work email, phone, time zone, location, short bio, LinkedIn/website, pronouns (optional) and preferred language for summaries.
- **Photo upload:** goes to a new `avatars` storage bucket (public read, owner write), cropped to a square. Initials are the fallback.
- **Where profiles appear:** profile cards with a hover preview everywhere a person shows up (team list, shared-with, comments, speakers, backlog), a team directory on `/team`, and `/settings/profile` for editing.
- **Speaker linking:** "Speaker A" can be linked to a real profile, so transcripts show names and photos.
- **Data:** extend `profiles`, with RLS so teammates see each other's work fields, and phone numbers only when the person allows it.

### 1.2 Notifications
- **Bell icon:** in the header (desktop and phone) with an unread count. It updates live (Supabase Realtime), and the dropdown lists recent items with "mark all read."
- **Events:**
  - transcript ready, summary ready, transcription failed
  - shared with you, comment or @mention, action item assigned or due
  - team invite accepted
  - billing events: payment failed, trial ending, plan changed
- **Channels:**
  - **In-app:** the bell.
  - **Email:** through Resend. A person can add more addresses, each verified by a link.
  - **SMS:** through Twilio. The phone number is verified with Twilio Verify.
  - **Desktop and phone push:** Web Push with a service worker. It works on desktop browsers, on Android, and on iPhone once Echo is installed to the Home Screen; the manifest and icons are already in place.
- **Settings page** (`/settings/notifications`): a grid of event × channel switches, quiet hours, and a daily digest option.
- **Data:** `notifications`, `notification_preferences` and `notification_channels` (verified email, phone and push subscriptions), plus a small server-side dispatcher.
- **SMS compliance:** US business texting needs **A2P 10DLC registration** in Twilio, and STOP/HELP handling is mandatory. Plan a week or two for carrier approval.

### 1.3 Share
- **Dialog step 1, what you're sharing:**
  - Audio, Transcript, Highlights, Summary, Action items
  - Full report (any mix of the above)
- **Step 2, the format:**
  - **Link:** a public web report, like the one in the hero demo.
  - **PDF:** Echo-branded, with a QR/link to the audio, because a PDF can't reliably play audio itself.
  - **Embed:** an `<iframe>` snippet with a player and transcript.
  - **HTML file:** a self-contained download.
  - **Text formats:** DOCX, TXT, SRT/VTT captions, Markdown.
- **Step 3, how you're sharing it:**
  - copy a link
  - invite people (Echo users get access; others get a link)
  - send by email or SMS
  - send to an integration (Slack, Google Drive, Notion…)
- **Link options:** expiry date, password, allow download, hide speaker names, and view count and analytics.
- **Data:** `share_links` (token, what, format, options) and `share_recipients`. Public pages at `/s/[token]` are served through a security-definer lookup that returns only the shared parts.

### 1.4 Referrals and affiliates
- **Referrals (everyone):** a personal invite link. Both sides get a reward, for example one month free or extra minutes, applied as a Stripe coupon.
- **Affiliate program (partners):**
  - partners apply and an admin approves them
  - each partner gets a code and link, with a commission rate (for example 20–30% recurring for 12 months)
  - a dashboard shows clicks, sign-ups, paid conversions and earnings
  - payouts start out manual (an exported report), with Stripe Connect later
- **Build or buy:** building it fits the Super Admin plan. Rewardful or FirstPromoter would be faster to start and plug into Stripe. **Decision needed.**

---

## Phase 2: Billing (Stripe)

- **Plans** (prices are placeholders, to set in the Stripe dashboard):

  | Plan | Who | Monthly | Annual (about 2 months free) | Includes |
  |---|---|---|---|---|
  | Free | Try it | $0 | $0 | 300 min/month, 30-day history, basic summaries |
  | Pro | Individuals | $15 | $144/yr | 2,000 min, unlimited history, all AI models, PDF/web reports |
  | Business | Teams | $20/seat | $192/seat/yr | Pro + shared workspace, admin roles, SSO-ready, priority support |
  | Enterprise | Large orgs | Custom | Custom | SLA, data residency, custom limits, invoicing |

- **Team discounts:** Business uses Stripe **graduated per-seat pricing**, so the price per seat drops as seats are added. For example: seats 1–5 at $20, 6–20 at $17, 21+ at $14. Seat count syncs from workspace membership.
- **Usage beyond the plan:** extra transcription minutes are billed through **Stripe usage metering**, or bought as a pack.
- **Flows:**
  - Stripe Checkout, plus the Customer Portal for card changes, invoices and cancelling
  - trials, coupons and promo codes
  - Stripe Tax
- **Behind the scenes:**
  - Stripe webhooks keep `subscriptions` and `entitlements` tables in sync.
  - Every limit (minutes, storage, features) is checked on the server against `entitlements`.
  - The `/billing` page shows the plan, usage bars and an upgrade path.
- **Security decision:** Stripe webhooks need trusted writes with no user signed in. That conflicts with "no service-role key in request paths." Proposal: a dedicated webhook route that verifies Stripe's signature and calls narrow security-definer functions (for example `private.apply_stripe_event`). No broad service-role client. **Needs your approval.**

---

## Phase 3: Bolt-ons and the Echo API (expanding the market)

### 3.1 Echo API (the core bolt-on)
- **REST API** with API keys per workspace (created and revoked in `/developer`) and scoped permissions. Endpoints cover recordings, transcripts, summaries, action items, search and upload.
- **Webhooks:** `recording.created`, `transcript.ready`, `summary.ready`, `action_item.created`, `share.viewed`. Signed, with retries and a delivery log.
- **For developers:** an OpenAPI spec, public docs at `/docs/api`, a JavaScript SDK, and per-plan rate limits.
- **The existing MCP connector** becomes the "AI bolt-on" (Claude, ChatGPT and others).

### 3.2 Paid bolt-ons (add to any plan)
- **API & webhooks:** pipe Echo data into any platform.
- **CRM sync:** HubSpot, Salesforce, Pipedrive, GoHighLevel. Summaries, action items and call logs land on the contact or deal.
- **Meeting bot:** joins Zoom, Meet and Teams from your calendar and records automatically. Built on a bot provider such as Recall.ai, so no one has to keep a browser tab open.
- **Phone line:** a Twilio number that records and transcribes inbound and outbound calls, plus call forwarding.
- **AI agents:** automatic follow-up emails, CRM updates, task creation in Asana/ClickUp/Linear, and coaching scorecards.
- **Extra minutes and storage packs.**
- **Translation and multilingual summaries.**
- **Custom vocabulary and speaker recognition.**
- **White-label:** custom domain, logo and colors on share pages and emails, for agencies and resellers.
- **Compliance pack:** HIPAA BAA, data retention rules, audit export, regional storage.
- **Hardware import:** Plaud and other voice recorders, plus voice memos from your phone by email or share sheet.

### 3.3 Market expansion ideas
- **Vertical editions:** template packs, landing pages and onboarding for sales, recruiting, real estate, legal intake, healthcare (with the compliance pack), coaching and therapy notes, churches and ministries, and podcasting and journalism.
- **Agency and reseller program:** resell Echo white-labelled with wholesale seat pricing, managed from Super Admin.
- **No-code marketplace apps:** Zapier, Make and n8n, to reach thousands of tools without building each integration.
- **Template marketplace:** public summary templates, such as Discovery call, Board meeting and Sermon notes. They double as SEO pages.
- **Free tools as lead magnets:** a free audio-to-text converter (with limits), a meeting-notes generator, and a podcast show-notes generator.
- **Your other services:** connect Echo to the services you already run (**which ones? see the questions below**). Shared sign-in, cross-sell in-app, and data flowing both ways.

---

## Phase 4: Super Admin control center

Reuses as much as possible from the GitHub project you'll share. Everything is behind `private.is_super_admin()`, and every action goes to the audit log.

- **Users and workspaces:** search, profiles, plan, usage, suspend or restore, and read-only "view as user" for support.
- **Billing:** subscriptions mirrored from Stripe, MRR/ARR and churn, failed payments, refunds through Stripe, and coupons and promo codes.
- **Plans and bolt-ons:** which features each plan or bolt-on unlocks (an entitlements editor), mapped to Stripe prices.
- **Affiliates:** applications, commission rates, payouts and fraud flags.
- **Notifications:** email and SMS templates, delivery logs, Twilio and Resend health.
- **Platform settings:** AI and transcription providers (already started), feature flags, rate limits, maintenance banner.
- **Costs:** AI and transcription spend per user and per plan, so margins stay visible.
- **Content:** blog and SEO page editor (Phase 5).
- **API:** keys, webhook deliveries and usage per workspace.

---

## Phase 5: Marketing site, blog and SEO

- **Blog:**
  - posts with authors, categories and tags, edited in Super Admin
  - Markdown with images, scheduled publishing, and draft preview links
- **SEO basics:**
  - `sitemap.xml` and `robots.txt`
  - canonical URLs and per-page titles/descriptions
  - auto-generated Open Graph images (`next/og`)
  - structured data: Organization, SoftwareApplication, Article, FAQ and Breadcrumb
  - RSS feed
  - Core Web Vitals kept green
- **Pages built from data, for search:**
  - use-case pages ("Meeting notes for real estate agents")
  - integration pages ("Echo + HubSpot")
  - the public template gallery
  - honest comparison pages
- **Content plan:** about 2–4 posts a month aimed at buyer searches ("best way to record sales calls," "how to transcribe a Zoom meeting"), each linking to a free tool or template.
- **Pages still needed before launch:** Privacy Policy, Terms, Contact/Support, About, Security/Trust. The "safeguards" you mentioned go in at launch time, including "coming soon" labels where needed.

---

## Suggested order

1. **Phase 1.1 Profiles**, then **1.2 Notifications**: everything else uses people and alerts.
2. **Phase 1.3 Share**: high user value; reuses the web report and PDF design.
3. **Phase 2 Billing**: turn on revenue before the bigger bolt-ons.
4. **Phase 4 Super Admin**, built up alongside each phase (start once the GitHub project is in).
5. **Phase 5 Blog and SEO**: can start in parallel, since SEO takes months to compound.
6. **Phase 3 API and bolt-ons**: the API and webhooks first, then CRM sync and the meeting bot.
7. **Phase 1.4 Affiliates**: once billing is live.

## Decisions needed from you
1. **The GitHub project** with the Super Admin features: link and access.
2. **"Other services I'm already offering":** which ones (for example Channel Cast, LayeredFX, MJG), and what should connect: shared sign-in, data, cross-sell?
3. **Plan prices** and the seat discount tiers (the table above is a placeholder).
4. **Affiliates:** build in-house, or use Rewardful/FirstPromoter?
5. **Stripe webhook security** approach (Phase 2 note).
6. **Twilio:** is there a sending number and A2P 10DLC registration already, or start one?
7. **Meeting bot provider** (Recall.ai or similar): the pricing affects plan margins.
