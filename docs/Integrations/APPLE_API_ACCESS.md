# Apple access (setup for Redial)

For Jeremy and developers. Apple works differently from Google and Microsoft. There's no single "connect your Apple account" permission screen for calendars and contacts. Redial reaches Apple in four ways:

1. **The Redial iPhone app (main path).** On an iPhone, the app asks for permission to use Calendar, Reminders and Contacts on the device. Those already include the person's iCloud calendars and contacts, and Exchange or Google calendars added to the phone. Calls ring through CallKit.
2. **iCloud on the web (CalDAV and CardDAV).** For people who use Redial in a browser, Redial can sync iCloud Calendar and Contacts with an **app-specific password** the person creates. Apple has no OAuth for iCloud data.
3. **Sign in with Apple** on the website and in the app.
4. **Apple Pay** at checkout, through Stripe.

What Apple doesn't offer to outside apps: iCloud Drive, Notes, iMessage and iCloud Mail have no web API. Redial can't sync them, so say so honestly.

Official docs:
- Apple Developer: https://developer.apple.com/account
- Sign in with Apple: https://developer.apple.com/sign-in-with-apple/
- EventKit: https://developer.apple.com/documentation/eventkit
- CallKit: https://developer.apple.com/documentation/callkit

## 1. Apple Developer Program (do this first)

1. Enroll at **developer.apple.com/programs/enroll** as an **organization** (Qallus LLC). It costs $99 a year.
2. You need a **D-U-N-S number** for Qallus LLC, the same one the Google Play organization account needs. Look it up or request it free from Dun & Bradstreet through Apple's enrollment page. Allow a few days.
3. Use an Apple ID on a redial.si address (for example jw@redial.si), with two-factor authentication on.
4. Note the **Team ID** (Membership details). Several steps below need it.

## 2. Identifiers, keys and certificates

In **developer.apple.com → Certificates, Identifiers & Profiles**:

| Item | Value | Used for |
|---|---|---|
| App ID | `si.redial.app` (the bundle ID in `mobile/app.json`). Capabilities: Sign in with Apple, Push Notifications | The iPhone app |
| Services ID | `si.redial.web`, with Sign in with Apple on. Domain `redial.si`; return URL `https://<project-ref>.supabase.co/auth/v1/callback` | Sign in with Apple on the website |
| Key: Sign in with Apple | Download the `.p8` once; note the Key ID | Creating Supabase's Apple client secret |
| Key: APNs (Apple Push Notifications service) | Download the `.p8` once; note the Key ID | Push notifications and VoIP call pushes in the app (uploaded to Expo/EAS) |

Keep both `.p8` files somewhere safe. Apple shows them only once.

## 3. Sign in with Apple (website and app)

1. **Supabase → Authentication → Providers → Apple:** turn it on and enter:
   - **Client IDs:** `si.redial.web,si.redial.app`
   - **Secret key:** a JWT made from the Sign in with Apple `.p8`, the Key ID, the Team ID and the Services ID. Supabase's Apple page links a generator.

   The secret expires after at most 6 months. Set a reminder to make a new one, or sign-in breaks.
2. **Email relay:** people can choose "Hide My Email", which gives Redial an @privaterelay.appleid.com address. For Redial's emails to reach them:
   - go to **Certificates, Identifiers & Profiles → Services → Sign in with Apple for Email Communication**;
   - register `redial.si` and the sending addresses (hello@, support@, and the Resend sending address);
   - SPF and DKIM must already pass, which they do through Resend.
3. **App Store rule:** an iPhone app that offers Sign in with Google must also offer Sign in with Apple, or an equally private option. Redial's app plans to offer it.

## 4. The iPhone app: Calendar, Reminders, Contacts and calls

These use Apple's on-device frameworks. Nothing is set up in a web console besides the App ID. With Expo they come from `expo-calendar` (Calendar and Reminders) and `expo-contacts`. Calls need native modules.

| Redial feature | Apple framework | Permission text the app shows (Info.plist) |
|---|---|---|
| Calendar two-way sync (bookings, appointments heard on calls, Live Agent shifts) | EventKit, full access | `NSCalendarsFullAccessUsageDescription`: "Redial adds your bookings and the appointments from your calls to your calendar, and checks it so you're not double-booked." |
| Action items to Reminders | EventKit (Reminders) | `NSRemindersFullAccessUsageDescription`: "Redial adds action items from your calls to Reminders." |
| Caller names, CRM import, dial by name | Contacts | `NSContactsUsageDescription`: "Redial shows your contacts' names on calls and lets you add them to Redial." |
| Redial calls ring like phone calls | CallKit plus PushKit (VoIP push through APNs) | No prompt. Needs the Push Notifications and Background Modes (Voice over IP) capabilities. |
| Notifications | User Notifications plus APNs | The standard notifications prompt |
| Recording a phone call | (Apple doesn't let apps record the phone app's calls) | On iPhone, recording works for Redial calls, or by merging a regular call with your Redial line (see ROADMAP.md) |

How phone sync works: the app reads and writes events on the device. Redial's server sends changes, and the app applies them when it opens or on a background refresh. People can pick which of the phone's calendars to sync.

## 5. iCloud on the web (CalDAV and CardDAV)

For people who use Redial only in a browser:

1. In Redial, they choose **Connect iCloud**.
2. They create an **app-specific password** at **account.apple.com → Sign-In and Security → App-Specific Passwords** (two-factor authentication must be on).
3. They enter their Apple ID email and that password in Redial. Redial stores the password encrypted, like other keys.
4. **Servers:**
   - Calendar: `https://caldav.icloud.com` (CalDAV)
   - Contacts: `https://contacts.icloud.com` (CardDAV)
5. **Sync:**
   - CalDAV has no push to outside servers, so Redial pulls changes every few minutes using sync tokens and ETags, and writes Redial's events right away.
   - Reminders aren't reliable over CalDAV since Apple's 2019 Reminders upgrade. Use the iPhone app for Reminders.
6. **Disconnect:** Redial deletes the stored password, and the person can also revoke it at account.apple.com.

## 6. Apple Pay

Redial's checkout uses **Stripe Checkout**, hosted on Stripe's site. Apple Pay appears automatically on iPhones and Macs when it's on in **Stripe → Settings → Payment methods**. No domain file is needed.

If Redial ever builds its own checkout page, register `redial.si` under **Stripe → Settings → Payment method domains**.

## 7. Apple Business Connect (optional, worth checking)

At **businessconnect.apple.com**, Qallus/Redial can manage how the business looks across Apple: Maps place card, logo, Branded Mail.

Apple has announced **Business Caller ID**, which shows the business name and logo on outgoing calls to iPhones. Check whether it's available for Redial's numbers, and whether Redial can offer it to its business customers. That would pair well with Redial's caller ID and fraud-protection features.

## 8. App Store

**App Store Connect** needs:
- the app record for `si.redial.app`;
- privacy "nutrition labels" that list contacts, calendar, audio and call data, all used for app features only and not for tracking;
- a demo account with a test line for reviewers;
- the account deletion feature, which Apple requires and which is already in the mobile plan.
