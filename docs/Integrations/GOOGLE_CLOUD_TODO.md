# Google Cloud Console: to-do list

Jeremy's checklist for setting up Google for Redial, in order. The reasons behind each step are in [GOOGLE_API_ACCESS.md](GOOGLE_API_ACCESS.md). Tick items off as you go. If a menu name doesn't match, search the console for it.

## Phase 0: Before you start
- [x] Decide which Google account owns the project. A redial.si Google Workspace account is best (for example jw@redial.si). Add a second owner later so you're never locked out.
- [x] Verify **redial.si** in **Google Search Console** (search.google.com/search-console): choose a **Domain** property and add the TXT record at your DNS provider.
- [x] Make sure **redial.si/privacy** and **redial.si/terms** are live. Ask Claude to add the "Google user data" section to the privacy policy; the draft is in GOOGLE_API_ACCESS.md §8.
- [x] Have a **square logo** ready (120×120 px PNG) and the support email **support@redial.si**.

## Phase 1: Project and APIs
- [x] Go to **console.cloud.google.com**, open the project picker, click **New project**, name it `Redial`, click **Create**, and select it.
- [x] Go to **APIs & Services → Library** and enable:
  - [x] Google Calendar API
  - [x] Gmail API
  - [x] People API
  - [x] Google Drive API
  - [x] Google Docs API
  - [x] Google Sheets API
  - [x] Google Slides API
  - [x] Google Picker API
  - [x] Google Meet REST API (optional, for later)
  - [x] Google Tasks API (optional, for later)

## Phase 2: Google Auth Platform (consent screen)
- [x] Go to **Google Auth Platform** (some accounts call it "OAuth consent screen") and click **Get started**:
  - App name `Redial`, support email support@redial.si, Audience **External**, contact email your email.
- [x] **Branding:**
  - logo, home page `https://redial.si`, privacy `https://redial.si/privacy`, terms `https://redial.si/terms`;
  - authorized domain `redial.si`;
  - click **Save**.
- [x] **Audience → Test users:** add your own Google account and any staff who will test.
- [x] **Data Access → Add or remove scopes.** Tick only the starter scopes:
  - [x] `openid`, `.../auth/userinfo.email`, `.../auth/userinfo.profile`
  - [x] `.../auth/calendar.events`
  - [x] `.../auth/calendar.calendarlist.readonly`
  - [x] `.../auth/drive.file`
  - [x] `.../auth/gmail.send`
  - [x] `.../auth/contacts.readonly`
  - Don't add `gmail.readonly` or the full `drive` scope; those need a paid security audit.
  - Paste each justification from GOOGLE_API_ACCESS.md §3, then click **Save**.

## Phase 3: The app's client (for Redial users connecting Google)
- [x] Go to **Clients → Create client → Web application**, name `Redial web`:
  - Authorized JavaScript origins: `https://redial.si`
  - Authorized redirect URIs:
    - `https://redial.si/api/integrations/google/callback`
    - `https://redial.si/api/calendar/google/callback`
  - Click **Create**.
- [x] Copy the **Client ID** and **Client secret**.
- [x] In Redial, go to **Admin → Settings → Integrations → Calendar sync → Google Calendar sync**, paste both, and click **Save**.

## Phase 4: Sign in with Google (optional, can wait)
- [ ] In **Supabase → Authentication → Providers → Google**, copy the **Callback URL** shown there.
- [ ] Back in Google: **Clients → Create client → Web application**, name `Redial sign-in`, redirect URI = that Supabase callback. Create it and copy the ID and secret.
- [ ] In Supabase, turn the Google provider on, paste the ID and secret, and save.
- [ ] Ask Claude to switch on `NEXT_PUBLIC_GOOGLE_AUTH_ENABLED` (a Coolify variable) so the Google button appears.

## Phase 5: Redial's own Workspace (optional, can wait)
Only needed when Redial itself should send from or file into @redial.si accounts.
- [ ] **IAM & Admin → Service Accounts → Create**, named `redial-workspace`. Then **Keys → Add key → JSON** and download it.
- [ ] Copy the service account's **Client ID** (the long number).
- [ ] In **admin.google.com → Security → Access and data control → API controls → Manage Domain Wide Delegation → Add new**:
  - paste the Client ID;
  - add the scopes `https://www.googleapis.com/auth/gmail.send,https://www.googleapis.com/auth/drive.file`;
  - authorize.
- [ ] Keep the JSON file safe. Claude adds an Integrations field for it when this feature is built.

## Phase 6: Test (while the app is in "Testing")
- [x] Tell Claude the keys are saved; Claude builds **Connect Google** (Calendar first).
- [ ] Run `supabase/migrations/20261121090000_google_calendar_sync.sql`. Then in Redial, go to **Settings → Connected accounts → Connect Google** and sign in with a test user.
- [ ] Check that a booking made in Redial appears in Google Calendar, and that an event moved in Google Calendar moves in Redial.
- [ ] Remember: in Testing, test users must reconnect every 7 days. That's normal until Phase 7.

## Phase 7: Publish and verify (before customers and Live Agents can connect)
- [ ] Record a short **demo video** and upload it to YouTube as **Unlisted**. Show:
  - the Google sign-in;
  - the consent screen with "Redial";
  - each feature using its scope: calendar sync, an email sending, a contact's name showing.
- [ ] Go to **Audience → Publish app**, then **Verification Center → Submit for verification**. Paste the video link and the scope justifications.
- [ ] Answer Google's emails quickly. Reviews of sensitive scopes usually take a few days to a few weeks.
- [ ] Later, only if Redial needs to read Gmail or the whole Drive: plan for the yearly **CASA security assessment** before adding those scopes.

## Keep in mind
- **Never share the client secret or the service account JSON** in chat, email or code. They go only in Admin → Settings → Integrations.
- **If a secret leaks:** create a new one in **Clients → Redial web → Add secret**, save it in Integrations, then delete the old one.
