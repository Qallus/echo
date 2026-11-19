# Google Cloud Console: to-do list

Jeremy's checklist for setting up Google for Redial, in order. The reasons behind each step are in [GOOGLE_API_ACCESS.md](GOOGLE_API_ACCESS.md). Tick items off as you go. If a menu name doesn't match, search the console for it.

## Phase 0: Before you start
- [ ] Decide which Google account owns the project. A redial.si Google Workspace account is best (for example jw@redial.si). Add a second owner later so you're never locked out.
- [ ] Verify **redial.si** in **Google Search Console** (search.google.com/search-console): choose a **Domain** property and add the TXT record at your DNS provider.
- [ ] Make sure **redial.si/privacy** and **redial.si/terms** are live. Ask Claude to add the "Google user data" section to the privacy policy; the draft is in GOOGLE_API_ACCESS.md §8.
- [ ] Have a **square logo** ready (120×120 px PNG) and the support email **support@redial.si**.

## Phase 1: Project and APIs
- [ ] Go to **console.cloud.google.com**, open the project picker, click **New project**, name it `Redial`, click **Create**, and select it.
- [ ] Go to **APIs & Services → Library** and enable:
  - [ ] Google Calendar API
  - [ ] Gmail API
  - [ ] People API
  - [ ] Google Drive API
  - [ ] Google Docs API
  - [ ] Google Sheets API
  - [ ] Google Slides API
  - [ ] Google Picker API
  - [ ] Google Meet REST API (optional, for later)
  - [ ] Google Tasks API (optional, for later)

## Phase 2: Google Auth Platform (consent screen)
- [ ] Go to **Google Auth Platform** (some accounts call it "OAuth consent screen") and click **Get started**:
  - App name `Redial`, support email support@redial.si, Audience **External**, contact email your email.
- [ ] **Branding:**
  - logo, home page `https://redial.si`, privacy `https://redial.si/privacy`, terms `https://redial.si/terms`;
  - authorized domain `redial.si`;
  - click **Save**.
- [ ] **Audience → Test users:** add your own Google account and any staff who will test.
- [ ] **Data Access → Add or remove scopes.** Tick only the starter scopes:
  - [ ] `openid`, `.../auth/userinfo.email`, `.../auth/userinfo.profile`
  - [ ] `.../auth/calendar.events`
  - [ ] `.../auth/calendar.calendarlist.readonly`
  - [ ] `.../auth/drive.file`
  - [ ] `.../auth/gmail.send`
  - [ ] `.../auth/contacts.readonly`
  - Don't add `gmail.readonly` or the full `drive` scope; those need a paid security audit.
  - Paste each justification from GOOGLE_API_ACCESS.md §3, then click **Save**.

## Phase 3: The app's client (for Redial users connecting Google)
- [ ] Go to **Clients → Create client → Web application**, name `Redial web`:
  - Authorized JavaScript origins: `https://redial.si`
  - Authorized redirect URIs:
    - `https://redial.si/api/integrations/google/callback`
    - `https://redial.si/api/calendar/google/callback`
  - Click **Create**.
- [ ] Copy the **Client ID** and **Client secret**.
- [ ] In Redial, go to **Admin → Settings → Integrations → Calendar sync → Google Calendar sync**, paste both, and click **Save**.

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
- [ ] Tell Claude the keys are saved; Claude builds **Connect Google** (Calendar first).
- [ ] In Redial, go to **Settings → Connected accounts → Google → Connect** and sign in with a test user.
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
