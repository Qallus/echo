# Microsoft API access (setup for Redial)

For Jeremy and developers. This covers how Redial gets access to Outlook Calendar, Outlook Mail, Contacts, OneDrive (Word and Excel) and Teams, and "Sign in with Microsoft", through one Microsoft Entra app (Azure AD). It works for personal Microsoft accounts (Outlook.com, Hotmail) and for work or school Microsoft 365 accounts.

Microsoft renames portal menus from time to time; search the portal if a label doesn't match. Official docs:
- Microsoft Graph permissions: https://learn.microsoft.com/graph/permissions-reference
- Register an app: https://learn.microsoft.com/entra/identity-platform/quickstart-register-app
- Publisher verification: https://learn.microsoft.com/entra/identity-platform/publisher-verification-overview

## 1. The setup at a glance

| Piece | What it is | Used for |
|---|---|---|
| Entra app registration **Redial** | One app for all users. Supported account types: **any organizational directory and personal Microsoft accounts** | Every Microsoft feature, plus Sign in with Microsoft |
| Client secret | The app's password. It expires (24 months at most), so put a reminder on the calendar | Server-to-Microsoft calls |
| Microsoft Graph | One API for Calendar, Mail, Contacts, OneDrive and Teams | All features |

An Azure subscription isn't needed. App registrations are free in Microsoft Entra.

## 2. Register the app

1. Go to **entra.microsoft.com** and sign in. Use a Microsoft account Redial will keep; a Microsoft 365 account on redial.si is best, but a free account works.
2. Go to **Identity → Applications → App registrations → New registration**:
   - **Name:** `Redial`
   - **Supported account types:** **Accounts in any organizational directory and personal Microsoft accounts**
   - **Redirect URI:** platform **Web**, address `https://redial.si/api/integrations/microsoft/callback`

   Click **Register**.
3. Under **Authentication**, add these redirect URIs as well:
   - `https://redial.si/api/calendar/microsoft/callback`
   - `https://<project-ref>.supabase.co/auth/v1/callback`, for Sign in with Microsoft
4. **Overview:** copy the **Application (client) ID**.
5. Go to **Certificates & secrets → New client secret**:
   - description `Redial`, expiry 24 months;
   - copy the **Value** right away (not the Secret ID), because it's shown only once.
6. **Branding & properties:** add the logo, home page `https://redial.si`, terms of service and privacy statement links, and the publisher domain `redial.si`.

## 3. Permissions by Redial feature (Microsoft Graph, delegated)

Delegated permissions act only as the signed-in person. Redial asks for each one when its feature is turned on.

| Redial feature | Permission | Personal accounts | Admin consent |
|---|---|---|---|
| Sign in / identify the account | `openid`, `profile`, `email`, `User.Read` | Yes | No |
| Stay connected (refresh tokens) | `offline_access` | Yes | No |
| Outlook Calendar two-way sync (bookings, appointments heard on calls, Live Agent shifts) | `Calendars.ReadWrite` | Yes | No |
| Send email from the person's own Outlook address | `Mail.Send` | Yes | No |
| Caller ID names, CRM import, dial by name | `Contacts.Read` | Yes | No |
| Save recordings, transcripts, summaries; Word and Excel exports (call logs, leads, Live Agent timesheets and earnings) | `Files.ReadWrite.AppFolder` | Yes | No. Only Redial's own folder in OneDrive (Apps → Redial). |
| Action items to Microsoft To Do (later) | `Tasks.ReadWrite` | Yes | No |
| Log received email on CRM records (later) | `Mail.Read` | Yes | No, but some companies block it |
| Teams meeting transcripts and recordings into Echo (later) | `OnlineMeetingTranscript.Read.All`, `OnlineMeetingRecording.Read.All` | No (work accounts only) | **Yes:** the company's admin must approve |

Add them in **API permissions → Add a permission → Microsoft Graph → Delegated permissions**. Leave out any permission whose feature isn't built yet.

## 4. Business customers: company admin approval

Many companies block apps from unverified publishers until an admin approves them. To make that easy:
- Send the company's IT admin this link, which approves Redial for their whole company:
  `https://login.microsoftonline.com/{their-tenant-id-or-domain}/adminconsent?client_id={Redial client ID}`
- Complete **publisher verification**:
  1. Join the Microsoft AI Cloud Partner Program to get a Partner ID (free).
  2. Make sure `redial.si` is a verified domain in Redial's Entra tenant.
  3. Add the Partner ID under **Branding & properties → Publisher verification**.

  Users then see a blue "verified" badge, and many companies allow verified apps without extra steps.

## 5. Where the keys go

| Key | Where |
|---|---|
| Application (client) ID and secret Value | Admin → Settings → Integrations → Calendar sync → **Microsoft Outlook calendar sync** (`MICROSOFT_CLIENT_ID`, `MICROSOFT_CLIENT_SECRET`). Used for every Microsoft feature, not only Calendar. |
| Sign in with Microsoft | Supabase → Authentication → Providers → **Azure**: the same client ID and secret, with Azure Tenant URL `https://login.microsoftonline.com/common` |

## 6. How syncing works (for the build)

1. **Connect:** the person signs in to Microsoft and approves. Redial stores the refresh token encrypted.
2. **First sync:** Redial reads the chosen calendar with a delta query (`/me/calendarView/delta`) and keeps the delta link.
3. **Changes from Outlook:**
   - Redial subscribes to change notifications (`/subscriptions` on the calendar). Microsoft pings Redial, and Redial pulls the changes with the delta link.
   - Calendar subscriptions last only a few days, so the cron job renews them.
   - A backup pull runs every few minutes.
4. **Changes from Redial:** written to Outlook right away. Each event stores the Outlook event ID, so nothing is duplicated.
5. **Disconnect:** Redial deletes the subscription and the stored tokens. The person can also remove Redial at **account.microsoft.com → Privacy → Apps and services** (personal accounts) or **myapps.microsoft.com** (work accounts).

## 7. Azure: what Redial does and doesn't need

- **Needed:** Microsoft Entra (free) for the app registration, Sign in with Microsoft, and company admin approval.
- **Not needed now:** an Azure subscription or paid Azure services. Hosting is on Coolify, voice on Twilio, and AI on the providers set in Admin → AI.
- **Optional later:**
  - **Entra single sign-on for business teams:** a company's staff sign in to Redial with their work account, which works through the same app.
  - Azure AI services, if Redial ever wants Microsoft's speech or AI models as another provider.

## 8. Rules

- Never ask for application permissions (app-only, `*.All` without a user) for customer data. Delegated permissions only.
- Microsoft's terms for Graph data are similar to Google's:
  - use data only for the feature;
  - no ads;
  - no selling;
  - no AI training.

  Put the same wording in the privacy policy (see the Google page) and name Microsoft as well.
