# Redial On-Demand Assistants: plan

**Status:** plan only, not built. **Working name:** Redial On-Demand Assistants. "Pros" and "Live" are other options, and Jeremy picks the final name.

## The idea
Businesses can hire real people, by the hour or on call, to answer their calls, transfer them and give support. Think of it as Airbnb for phone assistants.
- **Assistants** list themselves with a profile: photo, voice samples, experience, skills, languages, availability, rates and an approximate location.
- **Businesses** search the directory with filters or a map, message assistants inside Redial, and book them.
- **Contact details stay private** on both sides. All messages and calls go through Redial.
- **Redial collects the payment** from the business, keeps a platform fee, and pays the assistant out.

### Why it fits Redial
Most of the hard pieces already exist:
- **Calls reach an assistant through Directory transfers.** The AI answers first and puts the call through to a human assistant, using the same live controls (Insider, Audible, Gavel, Directory, Mirror).
- **Assistants answer in the Redial app** (mobile and web voice). Their personal number is never exposed.
- **Echo records, transcribes and summarizes** each call, so the business sees exactly what happened.
- **Voice samples come from the Recording Studio,** which shipped in `185587a`.
- **Stripe already handles billing.** Payouts are added with Stripe Connect.

---

## Who uses it

| Role | What they do |
|---|---|
| **Assistant** (new account type) | Builds a profile; sets rates, availability and payout account; answers messages; accepts bookings; takes calls in the Redial app; gets paid. |
| **Business** (existing Business account) | Browses and filters; messages assistants; books and pays; routes calls to the assistant; leaves reviews. |
| **Staff** (Super Admin) | Approves profiles, verifies identity, handles reports and disputes, watches payouts, sets the platform fee. |

---

## Accounts and profiles
- **New account type.** `profiles.account_type` gains `assistant`, alongside personal and business. Signup gets a third choice, "I want to work as an assistant", which leads to its own onboarding wizard, built like the existing `/setup` wizard.
- **One person, both roles.** A person can be a business owner and an assistant with one login, switching between the two.

**Assistant profile** (a public, approved listing)
- **Display:** first name and last initial, plus profile photo and gallery (up to 6). The full name is never shown.
- **Headline and bio.**
- **Experience:** entries with role, industry and years, plus a total years figure.
- **Skills and features, shown as icons:**
  - bilingual or multilingual;
  - appointment setting;
  - lead intake;
  - customer support;
  - order taking;
  - medical intake (HIPAA trained);
  - legal intake;
  - after-hours;
  - CRM entry;
  - de-escalation;
  - technical support.
- **Languages and industries.**
- **Voice samples:** 1 to 3 clips, each up to 30 seconds, recorded or uploaded in Studio and picked from it. They play on the card and on the profile page.
- **Availability:** a weekly schedule in the assistant's time zone, plus an "Available now" toggle.
- **Rates:** hourly, per-minute overflow, and a monthly on-call retainer. Assistants choose which they offer.
- **Location:** city and state only. The map pin is moved to an approximate point, so a home address never appears.
- **Badges:**
  - ID verified (Stripe Identity);
  - background checked (optional, later);
  - Top rated;
  - fast responder;
  - number of hours worked on Redial.
- **Ratings and reviews:** only from businesses with a completed booking. Assistants can reply.

---

## Finding an assistant (public: `/assistants`)
- **Results** as a grid of cards: photo, name, headline, rating, rate, top skill icons, voice sample play button, "Available now" dot.
- **Map view** with leaflet, which is already installed, showing approximate pins and clustering. "Search this area" when the map moves.
- **Filters:**
  - language, industry and skills;
  - price range;
  - availability (now, days and times, time zone);
  - minimum rating;
  - verified only;
  - years of experience;
  - distance from a city.
- **Sort:** best match, rating, price and response time.
- **Profile page** `/assistants/[slug]`: gallery, voice samples, experience, skills, availability calendar, reviews, and a "Message" button. Visitors who aren't signed in are asked to sign up as a business first.
- **SEO:** profile pages can be indexed. Assistants can switch this off, and personal details are never included.

---

## Messaging (private, inside Redial)
- **Conversations** are between one business and one assistant. They hold text, attachments (documents and audio) and booking offers.
- **Contact details are protected:**
  - before a booking, messages are scanned for phone numbers, emails and links meant to take the conversation outside Redial;
  - those details are hidden, and the sender is shown a reminder;
  - repeat attempts are flagged for staff.
- **Notifications** go through the existing notification system (in-app, email and text). Each person controls how often they're notified.
- **Reporting:** a "Report" button sends the conversation to the staff queue.

---

## Booking and getting calls to the assistant
**Offer types**
1. **Hourly block:** set hours on set days, for example Monday to Friday, 9 to 5.
2. **On-call coverage:** after hours or overflow, billed per answered minute with a monthly cap.
3. **Retainer:** a monthly fee for a set number of hours.

**How it works**
- **Flow:** the business sends an offer from the chat. The assistant accepts or counters, the business pays (or authorizes the card), and the booking becomes active.
- **Call routing:** while a booking is active, the assistant is added to the business line's Directory as a transfer target. Inbound calls ring the assistant according to the schedule, through the AI first if the business wants that.
  - The assistant answers in the Redial app. They can see the business's knowledge (the line's About text) and Mirror suggestions.
  - The assistant never sees the business owner's personal number, and the caller never sees the assistant's.
- **Time and minutes** come from `redial_calls` and the existing gateway minute counting. Each answered call gets a written summary, for quality and billing.
- **Wrap-up:** the business confirms, or the period auto-confirms after 72 hours. Payout is then released. Either side can open a dispute within the window.

---

## Payments (Stripe Connect)
- **Account type:** Stripe Connect Express accounts for assistants. Stripe handles identity checks, bank details and 1099 tax forms. No Square, per the standing rule.
- **Collecting payment:** businesses pay the platform through destination charges, with the assistant's account as the destination and an `application_fee` taken by Redial.
  - Hourly blocks and retainers are charged up front.
  - On-call minutes are billed weekly.
- **Payouts:** from Stripe to the assistant's bank on a schedule (weekly by default). The dashboard shows pending, available and paid balances.
- **Platform fee:** set in Admin → Billing, for example 15 to 20%. This is Jeremy's decision.
- **Refunds and disputes:** handled by staff in Admin, using Stripe refunds and transfer reversals.
- **Keys:** `STRIPE_CONNECT_CLIENT_ID` and the webhook secret go in Admin → Settings → Integrations, read through `secret()`.

---

## Data model (new tables; RLS on every one)

| Table | Holds | Who can see it |
|---|---|---|
| `assistant_profiles` | Profile fields, slug, status (`draft` → `pending` → `approved` / `paused` / `rejected`), approximate lat and lng, rates, badges | Public sees approved rows through a view without private columns; the owner has full access; staff see everything |
| `assistant_skills`, `assistant_languages`, `assistant_industries` | Tags | Same as the profile |
| `assistant_experience` | Experience entries | Same as the profile |
| `assistant_media` | Photos (storage path, order) | Same as the profile |
| `assistant_samples` | Voice samples, linked to `studio_audio` | Same as the profile; public playback uses short-lived signed URLs |
| `assistant_availability` | Weekly slots and time zone | Same as the profile |
| `assistant_payout_accounts` | Stripe Connect account id and status | Owner and staff only |
| `market_conversations`, `market_messages` | Chats between one business and one assistant | The two people in the chat, plus staff when reported |
| `market_bookings` | Offer type, schedule, rate, status, Stripe ids | The business, the assistant, and staff |
| `market_time_entries` | Minutes and hours per booking (from calls) | The business, the assistant, and staff |
| `market_reviews` | Rating and text, one per booking, plus the assistant's reply | Public |
| `market_reports` | Safety reports | The reporter and staff |

- **Helpers:** functions in the `private` schema, `security definer` with `auth.uid()` checks, for example `private.is_party(booking_id)`.
- **Staff access:** reads and writes go through `private.staff_can()` with a new `marketplace.manage` permission, and every change is written to the audit log.
- **Tests:** each table is tested with two users before shipping.

---

## Admin (Super Admin → Marketplace)
- **Approval queue:** check photos, bio and samples, then approve, reject or ask for changes.
- **Identity:** verification status from Stripe.
- **Reports and disputes:** a queue covering conversations, bookings and refunds.
- **Money:** payouts and platform fee revenue.
- **Settings:** the fee, the auto-confirm window, the contact-detail filter, and the allowed skills list.

---

## Trust, safety and legal (for review before launch)
- **Contractor status:** assistants are independent contractors. Marketplace terms need a lawyer's review: contractor classification, a confidentiality agreement accepted at signup, and a call recording consent policy.
- **HIPAA and legal intake:** only assistants who have confirmed training get those skills. Covered businesses may need a business associate agreement before using medical intake. This needs to be decided before that skill is offered.
- **Identity checks:** Stripe Identity before the first payout. Background checks (for example Checkr) as an optional badge.
- **Reviews:** only from completed bookings, with a moderation queue.
- **Contact details:** protected in messages and calls throughout.

---

## Steps (approval-gated, like the other tracks)
1. **M1. Assistant accounts and profiles:** the account type, onboarding wizard, profile editor (photos, experience, skills, languages, availability, rates), voice samples from Studio, admin approval queue.
2. **M2. Public directory:** `/assistants` with filters, grid, map and profile pages; marketing page and menu links.
3. **M3. Messaging:** conversations, contact-detail filter, notifications, reporting.
4. **M4. Payments setup:** Stripe Connect onboarding for assistants, platform fee setting, payout dashboard.
5. **M5. Bookings:** offers, accept or counter, checkout, booking calendar.
6. **M6. Call routing:** active bookings add the assistant as a Directory target on the business line, with the schedule; calls answered in the Redial app; time tracked from calls.
7. **M7. Wrap-up and payouts:** confirmation, auto-confirm, payouts, refunds and disputes in Admin.
8. **M8. Reviews and badges:** reviews, Top rated, fast responder, hours worked.

---

## Decisions for Jeremy
1. **Name** for the marketplace and for the people in it (for example "Redial Pros").
2. **How assistants charge:** hourly, per minute, retainer, or all three.
3. **Platform fee** percentage, and whether businesses or assistants pay it (or both).
4. **Launch area:** US only at first? It affects tax forms and payouts.
5. **Background checks:** required, or an optional badge.
6. **Who reviews profiles:** Redial staff only, or an AI pre-check first.
