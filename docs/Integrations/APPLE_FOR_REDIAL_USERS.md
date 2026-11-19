# Use Redial with your Apple devices and iCloud

For Redial users: home users, business teams and Live Agents with an iPhone, iPad or Mac. There are two ways Redial works with Apple: the Redial iPhone app, and connecting iCloud on the website.

> **Status:** coming soon. The Redial iPhone app and iCloud sync are being built. This page shows how they'll work.

## On your iPhone (the Redial app)

The first time you use a feature, the Redial app asks for permission. You can change your mind any time in **Settings → Redial** on your iPhone.

| Feature | What Redial does | The permission |
|---|---|---|
| **Calendar** | Bookings, appointments you agree to on calls, and Live Agent shifts go on your calendar. Redial checks your calendar so you're not double-booked. This works with iCloud and with any other calendar on your phone. | Calendars: Full Access |
| **Reminders** | Action items from your calls become reminders. | Reminders: Full Access |
| **Contacts** | Your contacts' names show on Redial calls, and you can add contacts to Redial. | Contacts |
| **Calls** | Redial calls ring like normal phone calls, even when the app is closed or your phone is locked. | (none, built in) |
| **Notifications** | Missed calls, messages, summaries and alerts. | Notifications |

## On the website (connect iCloud)

Apple doesn't have a "Sign in to connect" button for iCloud calendars. Instead, you create a one-time password just for Redial, called an app-specific password. Redial can only use it for your calendars and contacts, and you can cancel it whenever you like.

1. Go to **account.apple.com** and sign in. Two-factor authentication must be on.
2. Open **Sign-In and Security → App-Specific Passwords**, click **+**, and name it `Redial`.
3. Copy the password Apple shows you, for example `abcd-efgh-ijkl-mnop`.
4. In Redial, go to **Settings → Connected accounts → iCloud**, enter your Apple ID email and that password, and click **Connect**.
5. Choose which iCloud calendar to sync, and whether to show your iCloud contacts' names on calls.

Changes sync both ways every few minutes.

**Not possible with iCloud:** Apple doesn't let other apps use iCloud Drive, Notes, iMessage or iCloud Mail, so Redial can't save files there or read those. Use Google Drive or OneDrive for files.

## Sign in with Apple

You can sign in to Redial with your Apple ID. If you choose **Hide My Email**, Apple gives Redial a private relay address that forwards to you, and Redial's emails still reach you.

## Disconnect

- **iPhone app:** turn off Calendars, Reminders or Contacts in **Settings → Redial**, or delete the app.
- **iCloud on the website:** in **Settings → Connected accounts → iCloud**, click **Disconnect**. Redial deletes the password. You can also revoke it at **account.apple.com → Sign-In and Security → App-Specific Passwords**.
- **Sign in with Apple:** on your iPhone, go to **Settings → [your name] → Sign-In & Security → Sign in with Apple → Redial → Stop using Apple ID**.

## How Redial handles your Apple data

- Redial uses your calendar, reminders and contacts only for the features you turn on.
- Redial doesn't sell them, use them for ads, or use them to train AI models.
- App-specific passwords are stored encrypted, and only Redial's servers can use them.
- Questions: support@redial.si.
