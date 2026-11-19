# Google API access (setup for Redial)

For Jeremy and developers. This covers how Redial gets access to Google Calendar, Gmail, Contacts, Drive, Docs, Sheets, Slides and Meet, for Redial users and for Redial's own processes. The click-by-click checklist is [GOOGLE_CLOUD_TODO.md](GOOGLE_CLOUD_TODO.md); this page explains the choices behind it.

Google renames console menus from time to time. If a label below doesn't match, search the console for it. Official docs:
- OAuth scopes: https://developers.google.com/identity/protocols/oauth2/scopes
- Verification: https://support.google.com/cloud/answer/13463073
- Google API Services User Data Policy: https://developers.google.com/terms/api-services-user-data-policy

## 1. The setup at a glance

| Piece | What it is | Used for |
|---|---|---|
| Google Cloud project **Redial** | One project for everything | All APIs, both OAuth clients, the service account |
| OAuth client **Redial web** (Web application) | Redial users connect their Google account | Calendar sync, Gmail send, Contacts, Drive and Docs/Sheets/Slides exports, Meet |
| OAuth client **Redial sign-in** (Web application) | "Sign in with Google" through Supabase | Signing in to Redial |
| Service account **redial-workspace** with domain-wide delegation | Acts as @redial.si mailboxes only, inside Redial's own Workspace | Redial's own processes (team mailboxes, Redial's Drive and Sheets) |

The two OAuth clients can be one client, but keeping them separate means sign-in keeps working while the sync client is being reviewed or rotated.

## 2. APIs to enable

**APIs & Services → Library**, enable each one:

| API | Why |
|---|---|
| Google Calendar API | Two-way calendar sync |
| Gmail API | Send email from the user's own address; later, log email on CRM records |
| People API | Google Contacts: caller ID names, CRM import |
| Google Drive API | Save recordings, transcripts and summaries; host Docs, Sheets and Slides exports |
| Google Docs API | Write summaries and meeting notes as Google Docs |
| Google Sheets API | Export call logs, leads, Live Agent timesheets and earnings |
| Google Slides API | Meeting recap decks (later) |
| Google Picker API | Let people pick a Drive folder or file without giving Redial their whole Drive |
| Google Meet REST API (optional) | Bring Meet transcripts into Echo (later) |
| Google Tasks API (optional) | Echo action items to Google Tasks (later) |

Enabling an API costs nothing. These APIs are free within generous per-project limits.

## 3. Scopes by Redial feature

Google sorts scopes into three tiers:
- **Non-sensitive:** no review needed.
- **Sensitive:** needs app verification (branding, a justification for each scope, and a demo video). No outside audit.
- **Restricted:** also needs a **CASA security assessment** by an approved lab, renewed every year, which costs money and takes weeks.

**Plan:** launch with non-sensitive and sensitive scopes only. Add restricted ones later, only if a feature truly needs them.

| Redial feature | Scope | Tier | Notes |
|---|---|---|---|
| Sign in / identify the account | `openid`, `email`, `profile` | Non-sensitive | Every connection |
| Calendar two-way sync (bookings, appointments heard on calls, Live Agent shifts) | `https://www.googleapis.com/auth/calendar.events` | Sensitive | Read and write events |
| Pick which calendar to sync | `https://www.googleapis.com/auth/calendar.calendarlist.readonly` | Sensitive | Lists their calendars without event access |
| Save recordings, transcripts, summaries; create Docs/Sheets/Slides | `https://www.googleapis.com/auth/drive.file` | Non-sensitive | Only files Redial creates or the person picks in Google Picker. Docs, Sheets and Slides APIs accept this scope for those files, so no separate Docs/Sheets/Slides scopes are needed. |
| Send email from the person's own Gmail (CRM emails, follow-ups, missed-call emails) | `https://www.googleapis.com/auth/gmail.send` | Sensitive | Send only, no reading |
| Caller ID names, CRM import, dial by name | `https://www.googleapis.com/auth/contacts.readonly` | Sensitive | Read only |
| Meet transcripts into Echo | `https://www.googleapis.com/auth/meetings.space.readonly` | Check in console | Plus `drive.file`, or a Drive read scope for the transcript doc. Later. |
| Action items to Google Tasks | `https://www.googleapis.com/auth/tasks` | Sensitive | Later |
| Log received email on CRM records | `https://www.googleapis.com/auth/gmail.readonly` | **Restricted** | Needs CASA. Not at launch. |
| Full Drive access | `https://www.googleapis.com/auth/drive` | **Restricted** | Avoid; `drive.file` + Picker covers Redial's needs |
| Google Business Profile (hours, phone number) | `https://www.googleapis.com/auth/business.manage` | Sensitive | The Business Profile APIs also need a separate access request form. Later. |

**Ready-to-paste scope justifications** (Data Access → each scope):
- `calendar.events`: "Redial keeps the user's appointments in sync. Bookings made in Redial, and appointments the user agrees to on recorded calls, are added to the calendar they choose; changes made in Google Calendar are copied back so Redial never double-books."
- `calendar.calendarlist.readonly`: "Shows the user a list of their calendars so they can choose which one Redial syncs with."
- `gmail.send`: "Lets the user send emails they write in Redial (follow-ups to callers and CRM contacts) from their own Gmail address. Redial does not read the mailbox."
- `contacts.readonly`: "Shows the names of the user's own contacts on incoming calls and lets the user import contacts into their Redial CRM. Read only."

## 4. Redirect URIs and origins

Set these on the **Redial web** client:
- **Authorized JavaScript origins:** `https://redial.si`
- **Authorized redirect URIs:**
  - `https://redial.si/api/integrations/google/callback`
  - `https://redial.si/api/calendar/google/callback`
  - optional, for local testing: `http://localhost:3000/api/integrations/google/callback`

Set this on the **Redial sign-in** client:
- **Authorized redirect URIs:** `https://<project-ref>.supabase.co/auth/v1/callback`

Find `<project-ref>` in **Supabase → Authentication → Providers → Google**, which shows the exact callback address.

## 5. Where the keys go

| Key | Where |
|---|---|
| Redial web client ID and secret | Admin → Settings → Integrations → Calendar sync → **Google Calendar sync** (`GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`). This client is used for every Google feature, not only Calendar. |
| Redial sign-in client ID and secret | Supabase → Authentication → Providers → Google, then set `NEXT_PUBLIC_GOOGLE_AUTH_ENABLED=true` in Coolify |
| Service account key (JSON) | Admin → Settings → Integrations (a "Google Workspace (Redial)" field, added when that feature is built) |

## 6. How syncing works (for the build)

1. **Connect:** the person signs in to Google and approves the permissions. Redial stores the refresh token encrypted, tied to that person.
2. **First sync:** Redial reads the chosen calendar for the last 30 days through the next 12 months and saves Google's `nextSyncToken`.
3. **Changes from Google:**
   - Redial registers a push channel (`events.watch`) so Google tells Redial when something changes. Redial then pulls only the changes using the sync token.
   - The cron job renews channels before they expire.
   - It also runs a backup pull every few minutes, in case a notification is missed.
4. **Changes from Redial:**
   - Events created or edited in Redial are written to Google right away.
   - Each Redial event stores the Google event ID, so the same event is never duplicated in either direction.
5. **Disconnect:** Redial revokes the token with Google, stops the push channel and deletes the stored tokens.

## 7. Redial's own processes: domain-wide delegation

This is for jobs where Redial itself acts as an @redial.si account, for example:
- sending from hello@redial.si through Gmail;
- filing Redial's own reports in a shared Drive.

It only works inside Redial's own Google Workspace, so it can never touch a customer's account.

1. In the Redial project: **IAM & Admin → Service Accounts → Create**, name `redial-workspace`.
2. Open it, go to **Keys → Add key → JSON**, and download it.
   - If key creation is blocked, an organization policy is turning it off. Use Workload Identity Federation instead, or relax that policy for this project.
3. Copy the service account's **Client ID** (the long number).
4. In **admin.google.com → Security → Access and data control → API controls → Manage Domain Wide Delegation → Add new**:
   - paste the Client ID;
   - add only the scopes Redial's own jobs use, for example `https://www.googleapis.com/auth/gmail.send,https://www.googleapis.com/auth/drive.file`.
5. Save the JSON key in Admin → Settings → Integrations when that feature is built.

## 8. Verification (before business users and Live Agents can connect)

While the app is in **Testing**:
- only the test users you list (up to 100) can connect;
- each connection must be renewed every 7 days.

To open it to everyone:
1. **Search Console:** verify `redial.si` (domain property, through a DNS TXT record).
2. **Branding:** logo, home page `https://redial.si`, privacy policy, terms of service, and `redial.si` as an authorized domain.
3. **Privacy policy:** add a "Google user data" section. Draft wording:
   > Redial's use and transfer to any other app of information received from Google APIs will adhere to the Google API Services User Data Policy, including the Limited Use requirements. Redial uses Google data only to provide the features you turn on (calendar sync, sending email you write, showing your contacts' names on calls, saving files you choose). We don't sell it, don't use it for advertising, and don't use it to train AI models.
4. **Demo video:** unlisted on YouTube, a few minutes long, in English. It must show:
   - the Google sign-in screen;
   - the consent screen with the app name;
   - each scope being used in Redial (the calendar syncing, an email sending, a contact name appearing).
5. **Audience → Publish app**, then **Verification Center → Submit for verification**. Reviews of sensitive scopes usually take a few days to a few weeks.
6. **Restricted scopes later** (`gmail.readonly`, full `drive`): these require the CASA assessment. Plan for the cost and a yearly renewal before adding them.

## 9. Limits and costs

- The Calendar, Gmail, People, Drive, Docs, Sheets and Slides APIs have no per-call charge.
- Each has quotas per project and per user. See **APIs & Services → Quotas**, and request increases there if Redial grows into them.
- A Google Workspace subscription is needed only for Redial's own @redial.si accounts. Redial users can connect free Gmail accounts.
