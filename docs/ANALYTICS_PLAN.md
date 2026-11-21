# Redial Analytics: game plan

**Goal:** one place in **Admin → Analytics** that shows:
- where Redial's customers come from: Google search, AI assistants, social, email, texts, referrals and ads;
- what they do next: visit, sign up, set up Redial, pay, stay;
- what each channel is worth.

Each source feeds the same funnel, so you can compare channels directly. For example: "AI assistants sent 40 visitors this month, 6 signed up and 2 paid."

## 1. Where we are today

| Already built | Where |
|---|---|
| Admin → Analytics, 13 charts in 5 groups by day/week/month: signups, users who recorded, recordings, minutes recorded, revenue, paid orders, new leads, deals added, deals won, won value, calls, texts, emails sent, inbox messages, AI cost | `src/app/(admin)/admin/analytics`, `src/lib/admin/metrics.ts`, `admin_series` RPC |
| Reports: pipeline, owners, win/loss, lead sources, revenue, communications, product usage | `src/lib/admin/reports.ts` |
| Email delivery, opens, clicks, bounces (Resend webhooks) | `email_events`, `email_sends` |
| Texts and calls, opt-outs | `phone_messages`, `phone_calls`, `phone_opt_outs` |
| Business card views and taps | Admin → Business Cards → Analytics |
| Lead source on CRM contacts; the source page on the waitlist | `crm_contacts.source`, `app_waitlist.source_page` |
| Prospecting: lookups, providers, scores | `prospects`, `phone_lookups` |
| Analytics through the connector | `analytics_series` MCP tool |

**What's missing:**
- No visitor or traffic data for redial.si: no page views, referrers, UTM tags or landing pages.
- No Google Search data.
- No way to see AI assistants (ChatGPT, Perplexity, Gemini, Claude, Copilot) as a traffic source or a citation source.
- No social numbers.
- Signups aren't linked to the channel that brought them in, so nothing can be attributed.

## 2. Principles
- **Privacy first, no new cookies.** The privacy policy says Redial uses only the cookies needed to sign in and stay secure, and no advertising or cross-site tracking. So site analytics are **our own and cookie-free**:
  - Visitors are counted with a daily-rotating anonymous hash. No IP address or fingerprint is stored.
  - The channel that brought someone is kept in the browser's session storage, not a cookie, until they sign up.
  - This avoids a cookie banner. The policy still gets a short "Site analytics" paragraph.
- **One funnel, many sources.** Every number answers "how did they find us, and what did they do?"
- **Pull outside data on a schedule.** Data from outside services (Search Console, social, AI checks) is copied into our own tables by the existing 5-minute and daily scheduled jobs, so charts load fast and keep history.
- **Keys go in Integrations.** Every outside key is entered in Admin → Settings → Integrations and read with `secret()`.

## 3. Sources and what each one tells us

| Source | What we get | How | Cost | Needs from Jeremy |
|---|---|---|---|---|
| **redial.si itself** (first-party) | Visitors, page views, top pages, referrers, UTM campaigns, landing page → signup, form conversions (contact, partners, waitlist, demo, checkout) | A tiny script on public pages posts to `/api/t`; a `site_events` table; bots filtered | Free | Nothing |
| **Google Search Console** | Search clicks, impressions, rank and click rate, by search term and page | Search Console API (`webmasters.readonly`); daily copy | Free | Add Redial's Google service account as a user on the redial.si property (or connect his Google account) |
| **AI assistants: referrals** | Visits from chatgpt.com, perplexity.ai, gemini.google.com, copilot.microsoft.com, claude.ai, and ChatGPT's `utm_source=chatgpt.com` | Same first-party tracking, an "AI" channel | Free | Nothing |
| **AI assistants: crawlers** | Which AI bots read the site and which pages (GPTBot, OAI-SearchBot, ClaudeBot, PerplexityBot, Google-Extended, Applebot) | Logged in `src/proxy.ts` from the browser identifier each bot sends | Free | Nothing |
| **AI assistants: answer share** | How often Redial is named when people ask AI things like "best AI receptionist for a small business", "stop robocalls for my parents" or "RingCentral alternative" | A monthly job asks Claude, ChatGPT, Gemini, Grok and Perplexity (web search on) a set of questions you choose, and records whether Redial and competitors appear and which URLs are cited | About $1–5 a month | Approve the question list |
| **Email** (Resend) | Delivery, opens, clicks, bounces per send and campaign, **plus signups and sales from each campaign** | Existing `email_events`; UTM tags added to links automatically | Free | Nothing |
| **Texts** (Twilio) | Sent, delivered, failed, replies, opt-outs, **link clicks** and the signups they lead to | Existing data; delivery status callbacks; short tracked links `redial.si/l/…` | Free | Nothing |
| **Social** (LinkedIn, Meta) | Followers, reach, engagement per post, and clicks to the site and signups | First: UTM links (works today). Later: LinkedIn Pages and Meta Graph insights APIs | Free | Finish the LinkedIn and Meta app approvals (keys already have Integrations fields) |
| **Google Business Profile** | Profile views, calls, website clicks, directions | Business Profile Performance API | Free | API access request to Google; a Business Profile for Redial |
| **Ads** (Google Ads, Meta Ads), when you run them | Spend, clicks and conversions, giving cost per signup and return on ad spend | Ads APIs, or a monthly CSV import | Free | Ad accounts |
| **Stripe** | Monthly recurring revenue, new / expansion / cancelled revenue, cancellations, trial conversion | Existing `orders` / `subscriptions` and the Stripe webhook | Free | Nothing |
| **Redial product** | Setup wizard drop-off by step, first screened call, calls screened, scams blocked, minutes used, retention | Existing tables (`redial_setups`, `redial_calls`, `redial_protection_alerts`) | Free | Nothing |
| **Prospecting and sales** | Lookups → leads → deals → won, by provider (RingCentral, Cox, Spectrum…) | Existing prospecting and CRM tables | Free | Nothing |

Optional instead of first-party tracking: GA4, PostHog or Plausible. I'd keep our own. It matches the privacy promise, costs nothing, ties directly to signups and the CRM, and keeps the data in Supabase.

## 4. How a visitor becomes a number (attribution)
1. **On the first page view**, the script sorts the visit into a **channel** and keeps it for the session:

   | Signal | Channel |
   |---|---|
   | `utm_*` tags | **Campaign** (email, SMS, social or ads, by `utm_medium`) |
   | Search engine referrer | **Search** (Google, Bing, DuckDuckGo) |
   | AI site referrer | **AI** |
   | Social site referrer | **Social** |
   | Any other referrer | **Referral** |
   | No referrer | **Direct** |

2. **On signup, checkout or a form**, the channel, campaign, landing page and referrer are saved with the new account, lead or order. That's first touch and last touch.
3. **Every outbound link Redial sends** (emails, texts, business cards, partner links) gets UTM tags automatically, so those channels are always counted.
4. **Admin → Analytics → Acquisition** then reads straight across: visitors → signups → set up Redial → paying → revenue, by channel.

## 5. The dashboard (Admin → Analytics)
Same look as the rest of the admin: date range picker, stat tiles, charts, and tables that use the shared list layout and can be exported.

| Tab | Shows |
|---|---|
| **Overview** | The funnel (visitors → signups → activated → paying), monthly revenue, the top 5 channels, and this period against the last one |
| **Acquisition** | Each channel and campaign: visitors, signups, conversion rate, revenue; top landing pages and referrers |
| **Search** | Google clicks, impressions, average position, top search terms and pages, winners and losers |
| **AI** | AI referrals, AI crawler activity, answer share by assistant and question, cited pages |
| **Social** | Followers and engagement by network, top posts, clicks and signups from social |
| **Email & SMS** | Sends, delivery, opens, clicks, replies, opt-outs, and signups and revenue per campaign |
| **Product** | Setup drop-off by step, activation, calls screened, scams blocked, minutes used, retention |
| **Sales** | Prospecting funnel by provider, leads by source, pipeline, win rate (existing reports linked) |

**Also included:**
- **Connector tools:** "How did AI assistants do this month?" works from Claude.
- **Weekly digest:** a Monday summary email and Inbox note covering what moved, the top channels, and anything unusual.

## 6. Build plan (one approval-gated step at a time)

| Phase | What gets built | Needs from Jeremy |
|---|---|---|
| **1. First-party tracking + attribution** | `site_events` table (anonymous), `/api/t` endpoint and script on public pages, bot filter, channel rules including AI and search, UTM capture saved on signups, leads, waitlist, partner forms and orders, automatic UTM tags on email and text links, a privacy policy paragraph | Run 1 SQL file |
| **2. Analytics tabs: Overview + Acquisition** | Tabs on Admin → Analytics, funnel, channel and campaign tables, landing pages, referrers | Nothing |
| **3. AI visibility** | AI crawler log in `proxy.ts`, AI referral channel, the monthly answer-share job (`ai_visibility_checks`), AI tab | Approve the question list; 1 SQL file |
| **4. Google Search Console** | Daily sync into `search_console_daily` (search terms, pages, clicks, impressions, position), Search tab | Add the service account to Search Console, or connect Google; 1 SQL file |
| **5. Email, SMS and product tabs** | Campaign results with signups and revenue, SMS delivery callbacks and short links, setup funnel, activation and retention | 1 SQL file |
| **6. Social, Business Profile, ads** | LinkedIn and Meta insights, Business Profile performance, ad spend → cost per signup and return on ad spend | App approvals and ad accounts |
| **7. Digest + connector** | Monday digest, `analytics_*` connector tools, alerts on big swings | Nothing |

Phases 1 to 3 need no outside approvals and produce useful numbers within days of launch. Phase 4 starts as soon as Search Console access is granted. That's quick, because the domain is already verified.

## 7. What Jeremy needs to do (added to Plans when each phase starts)
1. Approve this plan and the phase order.
2. **For phase 3:** review and adjust the AI question list. Examples:
   - "best AI receptionist for small business"
   - "how to stop scam calls for elderly parents"
   - "RingCentral alternatives with AI"
   - "AI call screening app"
   - "home phone service with spam blocking Arizona"
3. **For phase 4:** in Search Console, go to **Settings → Users and permissions → Add user**. Add the Redial service account email with **Restricted** access. I'll provide the address when we create the service account.
4. **For phase 6:** finish the LinkedIn and Meta developer app reviews, and request Business Profile API access.
5. **Use UTM links** for anything posted by hand. The dashboard will have a small link builder.

## 8. What success looks like
- Every signup and paid order shows the channel that brought it.
- You can answer "which channel brings paying customers at the lowest cost?" from one screen.
- Google search terms and AI answer share are tracked month over month, and pages that move them are visible.
- Nothing here adds a tracking cookie or sells data.
