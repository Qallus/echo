# Step 8: the Redial mobile app, installed web app, Chrome extension

Status: plan, waiting for approval. Decided (Nov 5): the app is called **Redial**, and Echo is a feature inside it (Redial's call features are the core; Echo recordings are a major bonus). Android (Google Play) first; iPhone follows from the same codebase. Play Console as an organization (Qallus LLC), once the D-U-N-S number is found. Steps 1–7 (permissions, conference calls, Insider, Gavel, Audible, Directory, Mirror) are built on the web and need a real test call before the apps depend on them.

## What the apps are (and aren't)

- The Redial app (iPhone and Android) is the main way customers use their call assistant: the call inbox, the live call screen with all the controls, and settings. Echo lives inside it as its own tab: recordings, transcripts, summaries and Ask Echo. One app, one listing, one sign-in, the same account as the web.
- Calls reach Redial because they're routed to a Redial number (or a cell that forwards to it). Installing the app does not intercept ordinary cellular calls.
- Live audio in the app (listen, take over) uses the internet (Twilio Voice SDK). The app never dials the member's own cell, because that cell may forward to Redial and loop.
- "Your assistant is screening a call" is a normal notification. The phone doesn't ring like a call unless the member asked to be put through.
- Nothing in the app says a control worked until the server confirms it (the same rule as the web).

## Approach

- **One codebase for both platforms**: React Native with Expo, using a development build (not Expo Go), because Twilio's React Native Voice SDK needs native code.
- **In this repo**, in a new `mobile/` folder, so it shares types and labels (for example `src/lib/redial/features.ts`) with the web app.
- **Android first.** Builds and Play uploads with Expo Application Services (EAS): internal testing, then closed testing, then production. The iPhone build comes later from the same code (TestFlight, then App Store).
- **Same accounts and security as the web**: members sign in with their Echo account (Supabase), and every request runs as that member, so RLS stays the security boundary.

## Phases

### 8a. Mobile API (backend, this repo): built Nov 5
Reference: `docs/MOBILE_API.md`. One route, `/api/mobile/<name>` (`src/lib/mobile/routes.ts`), plus `/api/mobile/ask`; the member's token is set for the request (`src/lib/mobile/context.ts`) so the web's reads and server actions run unchanged. Push to phones through Expo in `/api/notifications/deliver`; `device_tokens` and `profiles.push_privacy` in `20261105120000_mobile_devices`; test `supabase/tests/mobile_devices_rls.sql`.

Original plan:
The web uses server actions, which a phone app can't call. Add a small REST API under `/api/mobile/*`:
- Authenticated with the member's Supabase access token (`Authorization: Bearer`), building a per-request Supabase client from it. No service-role key.
- Endpoints wrap the existing logic, so the web and the app behave the same: lines and calls, call detail and transcript, callbacks, live calls, listen ticket and voice token, take over, guide (Audible), transfer (Directory), Mirror start/stop/send, rules and assistant settings.
- **Push**: a `device_tokens` table (member, platform, token, app version) with RLS. Redial and Echo notifications are also delivered as push, through Expo's push service (APNs and FCM). Lock screen: full detail by default (caller and reason, e.g. "Mike (Strategic Income Group) is calling about a quote"); each person can switch to "Caller only" or "Private" in Settings, stored with their notification preferences.
- Tests: an RLS test for `device_tokens`, and API tests with two members.

### 8b. Android app, first release (Play internal testing)
Progress (Nov 5): `mobile/` app started (Expo SDK 58, Expo Router). Built: welcome with the animated call, sign-in and sign-up, setup (number with carrier forwarding codes, screening, assistant, notifications, test call), the six-card feature tour, Calls inbox and call detail (summary, transcript, call back, Block/VIP), Echo recordings and recording detail (summary, action items, transcript), Settings (lock-screen privacy, notifications, tour, sign out, delete account), push registration and notification deep links. Nov 6: live call card on the Calls tab and call screen (live transcript, who is on the call, Audible directions, Directory transfers, Mirror suggestions and drafts; checks every 2.5 s while live, paused in the background). Still to build in 8b: live voice (Insider, Gavel; native Twilio SDK), callbacks, recording audio playback, Ask Echo, app icon and splash artwork, first EAS build.

- **Onboarding** on first launch (see "Onboarding and feature tour" below).
- Sign in (email and password, magic link), sign out, delete account (required by Apple).
- Redial: call inbox, call detail (summary, message, voicemail, transcript where allowed), callbacks, quick block/VIP, basic rules (mode, pause).
- Live call card: status and live transcript, Audible, Directory, plus live voice: Insider (listen) and Gavel (take over), described under 8c and built as part of this release.
- Echo: recordings library, transcript and summary, Ask Echo.
- Push notifications with deep links into the right call (Firebase Cloud Messaging on Android).
- Tested on at least two real Android phones (a recent Pixel or Samsung and an older, cheaper one), including battery saver and "Do not disturb".
- **Not in 8b**: recording on the phone (that's 8d), and billing inside the app (members manage plans on the web, which avoids app store billing rules for now).

### 8c. Live audio on the phone (Insider and Gavel), part of the first test release
- Twilio Voice React Native SDK: listen muted (enforced by Twilio, as on the web), take over with the same server handoff.
- Audio routing (earpiece, speaker, Bluetooth), keeps working with the screen locked, using Android's call service (and CallKit later on iPhone).
- Testing on real Android phones, including weak connections, locking the screen mid-call, and an incoming cell call during a Redial call.

### 8d. Recording on the phone (Echo)
- Record a meeting or call from the phone, keep recording in the background, upload to the `recordings` bucket, then the usual transcription and summary.

### 8e. Play Store release (then iPhone)
- App Store and Play listings, screenshots, privacy details (Apple's privacy labels, Google's Data safety form), review notes with a demo account, and the age rating.
- iPhone: the same app built for iOS, TestFlight, App Store review.
- As each store goes live, its button on the website switches from the waitlist window to the real store links (`STORE_URLS` in `src/components/marketing/app-badges.tsx`), and the waitlist gets its launch emails and texts.

### 8f. Installed web app
- Offline page and app shell, an update prompt that never reloads during a live call, and install prompts on supported browsers.

### 8g. Chrome extension (Manifest V3 side panel)
- Inbox, live call status, Audible and Directory, callbacks, and "screen this number" for a number selected on a page.
- Listening and taking over open the web call console, because audio can't run reliably inside the extension.
- Published to the Chrome Web Store (needs a developer account).

## Onboarding and feature tour (part of 8b)

**Onboarding**, first launch, skippable after sign-in, each screen one job:
1. **Welcome**: the Redial name and a short animated call (the assistant answers, you take over), then "Get started" or "I have an account".
2. **Sign in or create account**: the same Echo account as the web.
3. **Your Redial number**: shows the number assigned to you, or "We're setting up your number" if there isn't one yet. Explains the two ways calls arrive: give out the Redial number, or forward your cell's unanswered calls to it, with step-by-step forwarding instructions for the person's carrier.
4. **Who gets screened**: unknown callers (default), everyone except VIPs, or off.
5. **Your assistant**: name, voice (with a short sample to play) and greeting, prefilled with the defaults.
6. **Notifications**: why they matter ("know when your assistant is screening"), then the system permission prompt. Microphone permission is asked later, the first time the person listens in or takes over, not during onboarding.
7. **Try it**: "Call your Redial number now" with a live status that updates when the test call arrives, or "Skip for now".

**Feature tour**: 6 animated cards, swipe or tap Next, skippable, and replayable from Settings → Feature tour:
1. Screening: the assistant answers and asks who's calling.
2. Insider: listen in, muted.
3. Audible: send the assistant a private direction.
4. Gavel: take over on the same call.
5. Directory and Mirror: transfer, and suggestions while you talk.
6. Echo: recordings, transcripts, summaries and Ask Echo.

The animations follow the web's demos (the home page phone animation and the Redial hero). The scripts (lines, timings) live in one shared file so the web and app tell the same story; the app draws them natively (React Native Reanimated). With reduced motion on, each card shows its finished frame.

Feature names come from `src/lib/redial/features.ts`, as on the web.

## What you need to set up (Android first)

1. **Google Play Console** as an organization (Qallus LLC): $25 once, and it needs a D-U-N-S number for the company. New personal accounts must run a closed test with at least 12 testers for 14 days before going public; organization accounts don't, which is why the organization account is recommended.
2. **Firebase project** (free) for Android push notifications. The same project later gives Twilio its push credential for call alerts (8c).
3. **Expo account** (free to start) for builds. Done: organization Qallus (`qallus`, signed in as `redial`), set as the owner in `mobile/app.json`; build profiles in `mobile/eas.json`, all pointing at https://redial.si.
4. **Two Android phones** for testing (see 8b).
5. A **demo account** with a test line for Google's reviewers.
6. Later: **Apple Developer Program** as an organization ($99 a year, same D-U-N-S number) for the iPhone app, and a Chrome Web Store developer account ($5 once).

## Decisions

1. ~~One app or two?~~ Decided: one app named Redial; Echo is a feature inside it.
2. ~~iPhone and Android together, or one first?~~ Decided: Android first.
3. ~~8b scope?~~ Decided: the list above plus live voice (Insider and Gavel, 8c) in the first test build.
4. ~~Lock-screen wording?~~ Decided: full detail by default, with Caller only and Private as per-person choices.
5. ~~Play Console account type?~~ Decided: organization (Qallus LLC), pending the D-U-N-S number.
