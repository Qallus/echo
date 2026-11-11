# Redial Assistants: On-Demand Phone Assistant Marketplace

> Status: **Proposal v1** (2026-11-10). Approval-gated. Build one step at a time, show what changed, then stop.
> Think "Airbnb for phone assistants": real people list themselves, businesses find and book them, Redial's AI answers first and hands live calls to the human.

---

## 1. The idea in one paragraph

Businesses that want a real person on the phone (overflow, after-hours, lunch coverage, a launch day, a bilingual line) browse **Redial Assistants**, real, vetted people with a profile, photo, short voice samples, skills, languages, rates and live availability. The business messages them through Redial (contact details stay private), sends an offer, and pays Redial. The Redial AI agent keeps answering every call; when a caller needs a human, it transfers to the booked assistant, who works from the browser or the mobile app with the call's context in front of them. Redial collects payment from the business and pays out to the assistant, minus the platform fee.

---

## 2. Roles

| Role | Who | How it fits Echo today |
|---|---|---|
| **Business** | An existing Echo/Redial workspace (owner/admin) | No new role. Gains a "Hire an assistant" area and a "Hiring" permission. |
| **Redial Assistant** (`assistant`) | An individual who lists themselves | **New account type.** A user with an `assistant_profiles` row and a Stripe Connect account. Gets their own dashboard at `/pro`. Can also belong to workspaces as a normal member. |
| **Marketplace staff** | Qallus staff in Super Admin | New `marketplace` permission for `requireStaff()`: approve profiles, review flags, disputes, refunds, payouts. |

A person can be both a business and an assistant. Account type is a capability, not a separate login.

---

## 3. User journeys

### 3.1 Assistant: get listed (onboarding wizard at `/pro/setup`, 7 steps)
1. **Basics.** Display name (first name + last initial shown publicly), headline, city/ZIP, time zone.
2. **Photo.** Profile photo (face-centered crop, moderated) + optional cover image of their workspace.
3. **Experience.** Years answering phones, past roles (company type, not name if they prefer), industries, short bio (300 chars), optional résumé PDF (private, staff-only).
4. **Skills and features.** Pick from an icon catalog (see §5). Languages with proficiency.
5. **Voice profile.** Record or upload **up to 3 samples, 15–30 seconds each** (greeting, a transfer, a hold/callback line). Auto-transcribed by Echo, loudness-normalized, compressed to ~64 kbps Opus. One sample is marked "featured".
6. **Rates and availability.** Per-minute on-demand rate, hourly scheduled rate, optional monthly retainer; weekly availability grid; "Available now" toggle; max concurrent businesses.
7. **Verify and get paid.** Stripe Identity (ID + selfie), Stripe Connect Express onboarding (bank/debit card, W-9 handled by Stripe), accept the Assistant Agreement and Code of Conduct. Optional background check (Checkr) for a "Background checked" badge.

Profile goes to **pending review** → staff approve → **live**. Assistants can pause their listing any time.

### 3.2 Business: find and hire
1. **Browse** `/assistants`: list + map split view, filters, sort (Best match, Rating, Price, Response time, Available now).
2. **Profile page**: photo, headline, badges, play voice samples, skills with icons, languages, experience, rates, availability calendar, reviews, approximate map area.
3. **Message** (Redial inbox, masked) to ask questions or **Request a trial** (a paid 30-minute test window).
4. **Send an offer**: engagement type, schedule, rate, script/notes, which Redial line(s), transfer rules. Assistant accepts or counters.
5. **Pay**: card on file (Stripe, existing billing). Scheduled and retainer work is authorized up front; on-demand is billed per minute weekly.
6. **Work**: Redial AI answers → transfers to the assistant per rules → call recorded and summarized by Echo → shows on both dashboards.
7. **Review** each other after each engagement (two-way, revealed when both submit or after 14 days).

### 3.3 Live call handoff (built on existing Redial features)
- **Directory** transfers the caller to the assistant's in-app softphone (Twilio Voice SDK, already a dependency); the assistant's personal number is never used.
- **Insider** lets the business listen silently; **Audible** lets the business message the assistant (and the AI) mid-call; **Gavel** lets the business take the call over.
- The assistant sees a **call card**: caller name/reason captured by the AI, business script, FAQs, transfer directory, notes field.
- If the assistant doesn't pick up in 20 s, the AI resumes and takes a message (no billing for unanswered transfers).

---

## 4. Engagement and pricing models

| Type | How it bills | Typical use |
|---|---|---|
| **On-demand** | Per connected minute, 1-minute minimum per call, billed weekly | Overflow, "a human when needed" |
| **Scheduled shift** | Hourly, authorized at booking, captured after shift | Lunch coverage, launch day, events |
| **Retainer** | Monthly flat for a block of hours/minutes, overage per minute | Ongoing virtual receptionist |
| **Trial** | Fixed 30-minute window at the assistant's hourly rate | Try before committing |

**Platform fee (proposal, needs decision):** business pays assistant rate **+ 10% service fee**; Redial keeps **15% of the assistant's rate**. Example: $30/hr shift → business pays $33, assistant receives $25.50, Redial nets $7.50 (before Stripe fees).

---

## 5. Profile content and the icon catalog

Skills live in a `marketplace_skills` table with a **lucide** icon name (already used in Echo), so staff can add skills without a deploy.

| Skill | Icon | Skill | Icon |
|---|---|---|---|
| Live answering | `phone-incoming` | Warm transfers | `phone-forwarded` |
| Appointment booking | `calendar-check` | CRM entry | `contact` |
| Bilingual (per language) | `languages` | Customer support | `life-buoy` |
| Order taking | `shopping-bag` | Lead qualification | `filter` |
| Medical office (HIPAA trained) | `stethoscope` | Legal intake | `scale` |
| Home services dispatch | `wrench` | Real estate | `home` |
| After-hours / overnight | `moon` | Outbound callbacks | `phone-outgoing` |
| Payments over phone (PCI trained) | `credit-card` | Email/SMS follow-up | `mail` |

**Badges** (computed, not self-claimed): `badge-check` ID verified · `shield-check` Background checked · `zap` Fast responder (median reply < 1 h) · `star` Top rated (4.8+, 10+ reviews) · `radio` Available now · `sparkles` Redial certified (passed the in-app training module).

**Public profile shows:** first name + last initial, photo, headline, city (never street), badges, voice samples, skills, languages, years of experience, industries, rates, availability, response time, completed engagements, reviews.
**Never public:** email, phone, full last name, exact address, résumé, ID documents, payout details.

---

## 6. Browse, search and map

- **Filters:** Available now · engagement type · price range (per minute / hourly) · languages · skills · industries · rating · verified / background checked · time zone or "can cover my hours" (matches the business's needed window against the assistant's availability) · response time · distance (only for businesses that want a local accent/area knowledge).
- **Sort:** Best match (default: availability fit + rating + response time + skill overlap), Rating, Price low→high, Response time, Newest.
- **Map:** Leaflet (already in `package.json`) with OpenStreetMap tiles. Pins are **fuzzed to a ~3 km circle** around the city centroid; clusters at low zoom; hovering a card highlights its pin. "Search as I move the map" toggle.
- **Fair-hiring rule:** no filters on age, gender, race, religion, accent or appearance. Voice samples exist so businesses can hear tone and clarity, not to screen protected traits. This goes in the Business Terms and is enforced in the filter set.

---

## 7. Messaging (masked, on-platform)

- New `conversations` / `conversation_participants` / `messages` tables, Supabase Realtime for live updates, push + email notifications through the existing notification pipeline.
- **Contact protection:** before an engagement is booked, a server-side filter masks phone numbers, emails, URLs and "text me at…" patterns (`[hidden until booked]`) and warns the sender. Repeated attempts flag the account for staff review. After booking, messages are still masked; all calls route through Redial.
- Message types: text, attachment (script PDF, FAQ doc), **offer card**, **counter-offer card**, **booking confirmation**, **system notices** (shift starting, payout sent).
- Report / block on every thread. Staff can read a thread only when it's reported (logged with `adminAudit`).

---

## 8. Payments and payouts (Stripe Connect)

Echo already runs Stripe (`src/lib/billing/*`, `/api/stripe/webhook`). Extend it, don't add a second provider.

1. **Assistants** onboard to **Stripe Connect Express**. Stripe collects bank/debit details, verifies identity, handles W-9 and **1099-K/1099-NEC** reporting.
2. **Businesses** pay with their existing Stripe customer/card.
3. **Charges:** platform charges the business (**separate charges and transfers**), so one business invoice can cover several assistants and minutes.
4. **Hold period:** funds are held 3 days after a shift or weekly on-demand cycle for disputes, then a **Transfer** goes to the assistant's connected account. Default payout schedule: weekly; instant payouts optional (Stripe fee passed through).
5. **Assistant payment methods screen:** connected bank/debit (managed in the Stripe Express dashboard link), payout schedule, earnings, upcoming transfers, tax documents.
6. **Disputes:** business can dispute within 72 h of a shift; staff review using the Echo call log, recordings and timestamps; partial or full refund; assistant can respond.
7. **No off-platform payments** clause in both agreements.

> Not legal or tax advice: get counsel to review the Assistant Agreement (independent-contractor status, state rules), the Business Terms, call-recording consent language (Arizona is one-party; California and others are two-party), and HIPAA/PCI claims before launch.

---

## 9. Data model (new migration files)

All tables: explicit grants, RLS on, policies via `(select auth.uid())`, helpers in `private` with `security definer set search_path = ''`.

| Table | Key columns | Who can read |
|---|---|---|
| `assistant_profiles` | `user_id` PK, display_name, headline, bio, city, region, tz, geo_fuzzed (lat/lng), years_experience, status (`draft/pending/live/paused/suspended`), stripe_account_id, identity_verified_at, background_checked_at, available_now, max_concurrent | Public (live, safe columns via a view `assistant_public`); owner; staff |
| `assistant_media` | id, user_id, kind (`avatar/cover`), storage_path, moderation_status | Public when approved |
| `assistant_voice_samples` | id, user_id, title, storage_path, duration_s (≤30), transcript, featured, moderation_status | Public when approved |
| `marketplace_skills` | id, slug, label, icon (lucide), category | Public |
| `assistant_skills` | user_id, skill_id | Public |
| `assistant_languages` | user_id, language, proficiency | Public |
| `assistant_industries` | user_id, industry | Public |
| `assistant_rates` | user_id, per_minute_cents, hourly_cents, retainer_cents, retainer_minutes | Public |
| `assistant_availability` | user_id, weekday, start_time, end_time | Public |
| `assistant_private` | user_id, resume_path, legal_name, notes | Owner + staff only |
| `favorites` | workspace_id, assistant_id | Workspace members |
| `conversations` / `conversation_participants` / `messages` | thread with workspace_id + assistant_id; body, body_masked, kind, payload jsonb | Participants only |
| `engagements` | id, workspace_id, assistant_id, type, status (`offered/countered/accepted/active/completed/cancelled/disputed`), rate_cents, schedule jsonb, script, line_ids | Both sides + staff |
| `engagement_shifts` | engagement_id, starts_at, ends_at, status | Both sides |
| `assistant_call_sessions` | engagement_id, call_sid, recording_id (Echo), connected_at, ended_at, billable_seconds | Both sides |
| `marketplace_charges` | workspace_id, engagement_id, stripe_payment_intent, amount, fee, status | Business + staff |
| `assistant_payouts` | assistant_id, stripe_transfer_id, amount, status, available_at | Assistant + staff |
| `reviews` | engagement_id, author_side, rating 1–5, text, revealed_at | Public when revealed |
| `marketplace_reports` | reporter, target, reason, thread_id, status | Staff |

Storage buckets: `assistant-media` (public read of approved files via signed transform), `assistant-voice` (public read of approved), `assistant-private` (owner + staff).

---

## 10. Screens and routes

**Public / business** (`(marketing)` + `(app)`):
- `/assistants`: browse with list + map + filters
- `/assistants/[handle]`: public profile
- `/become-an-assistant`: recruiting landing page
- `/app/hiring`: business view: favorites, active engagements, shifts calendar, spend
- `/app/messages`: inbox (shared by both sides)

**Assistant** (`/pro`):
- `/pro/setup`: 7-step onboarding wizard
- `/pro`: today's shifts, Available-now toggle, incoming offers, live call card
- `/pro/profile`: edit profile, photos, voice samples (recorder + trimmer)
- `/pro/earnings`: earnings, upcoming transfers, payout method, tax docs
- `/pro/calendar`: availability and booked shifts

**Super Admin** (`/admin/marketplace`): review queue (profiles, photos, voice samples), reports, disputes, refunds, payouts, skills catalog, fee settings.

**Mobile app** (`mobile/`): assistant dashboard, Available-now toggle, softphone, inbox, earnings. Same APIs (`docs/MOBILE_API.md`).

**MCP** (Track C): `assistant_search`, `assistant_get`, `engagement_create` (risk: high, needs confirm), `message_send`, `marketplace_review_queue`.

---

## 11. Trust and safety

- Staff approval before a profile goes live; photo and voice samples moderated (AI pre-screen + human).
- Stripe Identity required; background check optional but badged.
- Masked contact info and in-app calling only.
- Two-way reviews; ratings below 4.0 over 10+ engagements trigger staff review.
- Recordings and transcripts follow the business's Echo retention settings; assistants can't download recordings.
- Assistant can see only the businesses they're engaged with; business sees assistant performance only for its own engagements.
- Every staff action audit-logged.

---

## 12. Extra features worth adding (proposed)

1. **"Ring now" instant match.** A business taps one button and Redial transfers to the best-rated assistant who is Available now and matches skills (with a pre-set per-minute cap).
2. **Pools.** A business saves 3–5 favorites as a pool; transfers ring the pool in order.
3. **Redial Certified training.** Short in-app course plus a mock call graded by AI; unlocks a badge and higher ranking.
4. **AI call coach.** After each call, Echo gives the assistant private tips (pacing, missed info).
5. **Script and FAQ builder** for businesses, shown on the assistant's call card.
6. **Shift swap / backup.** Assistant can offer a booked shift to another approved assistant with the business's OK.
7. **Referral program** for both sides (credit after first paid engagement).
8. **Earnings goals and instant payouts** for assistants.

---

## 13. Build plan (approval-gated steps)

| Step | Deliverable | Depends on |
|---|---|---|
| 0 | Approve this plan, the fee split and the brand name ("Redial Assistants") | — |
| 1 | Migration: profiles, media, voice, skills catalog, languages, rates, availability + RLS + public view | 0 |
| 2 | `/pro/setup` wizard steps 1–6 (no payments yet), storage uploads, voice recorder (MediaRecorder, 30 s cap) | 1 |
| 3 | Super Admin review queue; profile goes live | 2 |
| 4 | `/assistants` browse: list, filters, sort, Leaflet map with fuzzed pins | 3 |
| 5 | Public profile page with voice player and reviews placeholder | 4 |
| 6 | Messaging: tables, Realtime inbox, masking filter, report/block, notifications | 5 |
| 7 | Stripe Connect Express onboarding (wizard step 7) + Stripe Identity | 2 |
| 8 | Offers and engagements: offer/counter/accept cards, shifts calendar | 6, 7 |
| 9 | Payments: charge business, hold period, transfers, earnings page, disputes | 8 |
| 10 | Live handoff: transfer AI → assistant softphone, call card, billable-seconds tracking | 8 |
| 11 | Reviews (two-way, blind reveal) and ranking | 9 |
| 12 | Mobile assistant screens + MCP tools | 10 |
| 13 | Extras from §12, one at a time | 11 |

**MVP = steps 1–10.** Steps 1–6 can ship as a "browse and message" beta with manual invoicing while Stripe Connect is set up.

---

## 14. Design mockups (in this folder)

Each folder is a design reference exported from Claude Design. Match its layout, spacing and type in Echo's own components and design tokens. Don't copy the markup. Open each mockup by serving its folder (for example `python -m http.server`).

| Mockup | Screen | Build step |
|---|---|---|
| `1 · Browse assistants (list + map + filters)-html/Main.dc.html` | `/assistants` list + map + filters | 4 |
| `2 · Assistant profile-html/Profile.dc.html` | `/assistants/[handle]` | 5 |
| `3 · Masked messaging + offer-html/Messages.dc.html` | `/messages` inbox with offer card | 6, 8 |
| `4 · Assistant onboarding — voice profile step-html/ProSetup.dc.html` | `/pro/setup` step 5, voice profile | 2 |
| `5 · Assistant dashboard, earnings & payouts-html/ProDashboard.dc.html` | `/pro` and `/pro/earnings` | 7, 9 |

---

## 15. Notes from the first draft plan (merged here)

These come from `docs/REDIAL_ON_DEMAND_ASSISTANTS_PLAN.md`, which this document replaces.

- **Routes.** Echo's dashboard pages sit in the `(app)` route group without a `/app` prefix. The business pages are therefore `/hiring` and `/messages`, not `/app/hiring` and `/app/messages`.
- **Voice samples reuse the Recording Studio** (`src/components/studio/*`, shipped in `185587a`). The step-5 recorder uses the Studio's microphone capture, player and WAV encoder, with a 30-second cap and trim. Assistants can also pick a clip they already made in Studio. Approved samples are copied to the `assistant-voice` bucket, so the private Studio bucket never becomes public.
- **Echo summary on every handoff.** After an assistant call, both sides get the Echo transcript and summary in the engagement timeline. Disputes are reviewed from the same record.
- **Mirror on the call card.** The assistant's call card shows Mirror's live suggestions, drawn from the business's About text and FAQs, next to the script.
- **Photo gallery.** Besides the avatar and cover, up to 4 workspace photos are allowed, each moderated.
- **Search engines.** Live profiles can be indexed by default. An assistant can turn this off, in which case the page gets `noindex`.
- **Auto-confirm.** If the business neither confirms nor disputes a completed shift or week within 72 hours, it's confirmed automatically and the payout hold starts. This is the same window as disputes in §8.
- **Accounts.** `profiles.account_type` already exists (personal or business, from the setup wizard migration). Being an assistant is stored as the `assistant_profiles` row, not as a third account type, so one person can still be both a business and an assistant (§2).
- **Agent tools.** The MCP tools follow the Track C risk levels: `engagement_create` and refunds are "high" and need confirmation, and messaging is "write".

---

## 16. Decisions needed from Jeremy

1. Name: **Redial Assistants** (alternatives: Redial Live, Redial Pros, Redial Humans).
2. Fee split: 10% business fee + 15% assistant fee? Or one 20% fee on the business side only?
3. Launch scope: US-only? Arizona first?
4. Background checks required or optional at launch?
5. Minimum rates (e.g. $0.50/min, $18/hr) to protect quality and fairness?
6. Can assistants work for competing businesses at the same time (default: yes, up to `max_concurrent`)?