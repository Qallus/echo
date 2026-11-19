# Integrations: Google, Microsoft and Apple

How Redial connects to the Google, Microsoft and Apple accounts that Redial (the company), its staff and its users already have. Each provider has two documents:

| Provider | Setup (Jeremy / developers) | For Redial users |
|---|---|---|
| Google | [GOOGLE_API_ACCESS.md](GOOGLE_API_ACCESS.md) | [GOOGLE_FOR_REDIAL_USERS.md](GOOGLE_FOR_REDIAL_USERS.md) |
| Microsoft | [MICROSOFT_API_ACCESS.md](MICROSOFT_API_ACCESS.md) | [MICROSOFT_FOR_REDIAL_USERS.md](MICROSOFT_FOR_REDIAL_USERS.md) |
| Apple | [APPLE_API_ACCESS.md](APPLE_API_ACCESS.md) | [APPLE_FOR_REDIAL_USERS.md](APPLE_FOR_REDIAL_USERS.md) |

Start here: [GOOGLE_CLOUD_TODO.md](GOOGLE_CLOUD_TODO.md), the step-by-step checklist for Google Cloud Console.

Status (Nov 18, 2026): nothing on these pages is built yet except the key fields in Admin → Settings → Integrations → Calendar sync. The user documents mark everything as "Coming soon" until it ships.

## Two kinds of access

1. **Redial users connect their own accounts.** Anyone can connect their Google, Microsoft or Apple account from their own dashboard: users, business teams and Live Agents. Redial acts only for that person, only with the permissions they approved, and they can disconnect at any time. This is the main use.
2. **Redial's own processes.** Redial's staff accounts (@redial.si) can also be used by Redial itself, for example to send from a team mailbox or keep Redial's own files in Drive. Google does this with a separate service account that only works inside Redial's own Google Workspace. It's never used for customer data.

## Rules for every integration

- **One app per provider:**
  - one Google Cloud project;
  - one Microsoft Entra app registration;
  - one Apple developer team.

  Users, business teams and Live Agents all connect through the same app.
- **Ask only for what a feature needs, when it's turned on.** Connecting a calendar asks for calendar access only. Turning on "Save recordings to Drive" later asks for Drive then, which Google calls incremental authorization. This keeps permission screens short and Google's review smaller.
- **Keys live in the dashboard.** Client IDs and secrets go in **Admin → Settings → Integrations**, and the code reads them with `secret()` (`src/lib/secrets.ts`). They never go in the code or straight from `process.env`.
- **Tokens are encrypted.** Each person's access and refresh tokens are stored encrypted, the same way `platform_secrets` are. Only the server reads them.
- **Disconnecting deletes the tokens.** It also revokes them with the provider where it can. Synced copies in Redial stay unless the person deletes them.
- **No AI training on their data.** Redial never uses data from Google, Microsoft or Apple accounts to train AI models. Calls to AI happen only to do the feature the person asked for: a summary, a draft, or adding an appointment.
- **Redirect addresses used by the app:**
  - Google: `https://redial.si/api/integrations/google/callback`
  - Microsoft: `https://redial.si/api/integrations/microsoft/callback`
  - Sign-in with Google, Microsoft or Apple goes through Supabase: `https://<project-ref>.supabase.co/auth/v1/callback`

  The calendar-only addresses already in the Integrations descriptions (`/api/calendar/google/callback`, `/api/calendar/microsoft/callback`) are kept as well, so register both.

## Redial features these connect to

| Redial feature | Google | Microsoft | Apple |
|---|---|---|---|
| Calendar: bookings, appointments heard on calls, Live Agent shifts | Google Calendar | Outlook Calendar | iCloud Calendar (CalDAV), iPhone Calendar |
| Contacts: caller ID names, CRM import, dial by name | Google Contacts | Outlook Contacts | iCloud Contacts (CardDAV), iPhone Contacts |
| Email: send from your own address, log email on CRM records | Gmail | Outlook Mail | (iCloud Mail has no API) |
| Files: recordings, transcripts and summaries | Drive, Docs | OneDrive, Word | (no iCloud Drive API) |
| Exports: call logs, leads, Live Agent timesheets and earnings | Sheets | Excel (OneDrive) | (Numbers has no API) |
| Meetings into Echo | Google Meet transcripts | Teams transcripts | (none) |
| Action items | Google Tasks (later) | Microsoft To Do (later) | iPhone Reminders |
| Sign in | Sign in with Google | Sign in with Microsoft | Sign in with Apple |
| Calls on the phone | (n/a) | (n/a) | CallKit, PushKit (iPhone app) |
