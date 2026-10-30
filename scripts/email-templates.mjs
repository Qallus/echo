// Builds Echo's Supabase Auth emails into supabase/templates/*.html.
//   node scripts/email-templates.mjs          -> write the HTML files
//   node scripts/email-templates.mjs --push   -> also upload subjects + HTML to the project
// --push needs SUPABASE_ACCESS_TOKEN (supabase.com/dashboard/account/tokens) and
// NEXT_PUBLIC_SUPABASE_URL (the project ref is read from it).
// Placeholders like {{ .ConfirmationURL }} are Supabase's Go template variables.

import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const OUT_DIR = join(import.meta.dirname, "..", "supabase", "templates");

// Echo theme (src/app/globals.css), as hex because email clients ignore oklch.
const C = {
  page: "#fafafa",
  card: "#ffffff",
  border: "#e5e5e5",
  text: "#0a0a0a",
  body: "#404040",
  muted: "#737373",
  primary: "#171717",
  onPrimary: "#fafafa",
  well: "#f5f5f5",
};
const FONT = "Geist, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";
const MONO = "'Geist Mono', ui-monospace, SFMono-Regular, Menlo, Consolas, monospace";

const HELLO = `{{ if .Data.full_name }}Hi {{ .Data.full_name }},{{ else }}Hi there,{{ end }}`;

// The AudioLines mark from the sidebar, drawn as table cells so it renders
// without images (Gmail strips SVG; Outlook blocks remote images by default).
const BARS = [5, 13, 20, 9, 15, 5];
const mark = BARS.map((h, i) => {
  const gap = i ? `<td width="2" style="width:2px;font-size:0;line-height:0;">&nbsp;</td>` : "";
  return `${gap}<td valign="middle" style="vertical-align:middle;"><table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr><td width="2" height="${h}" bgcolor="${C.primary}" style="width:2px;height:${h}px;background:${C.primary};border-radius:1px;font-size:0;line-height:0;mso-line-height-rule:exactly;">&nbsp;</td></tr></table></td>`;
}).join("");

const logo = `<table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
  <td valign="middle" style="vertical-align:middle;"><table role="presentation" cellpadding="0" cellspacing="0" border="0" height="20" style="height:20px;"><tr>${mark}</tr></table></td>
  <td width="10" style="width:10px;">&nbsp;</td>
  <td valign="middle" style="vertical-align:middle;font-family:${FONT};font-size:18px;line-height:20px;font-weight:600;letter-spacing:0.2em;color:${C.text};">ECHO</td>
</tr></table>`;

const p = (html) =>
  `<p style="margin:0 0 16px;font-family:${FONT};font-size:15px;line-height:24px;color:${C.body};">${html}</p>`;

const button = (href, label) => `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:8px 0 24px;"><tr>
  <td bgcolor="${C.primary}" style="background:${C.primary};border-radius:8px;">
    <a href="${href}" target="_blank" style="display:inline-block;padding:12px 22px;font-family:${FONT};font-size:14px;line-height:20px;font-weight:600;color:${C.onPrimary};text-decoration:none;border-radius:8px;">${label}</a>
  </td>
</tr></table>`;

const fallbackLink = (href) =>
  `<p style="margin:0 0 4px;font-family:${FONT};font-size:13px;line-height:20px;color:${C.muted};">Button not working? Paste this link into your browser:</p>
<p style="margin:0 0 24px;font-family:${MONO};font-size:12px;line-height:18px;word-break:break-all;"><a href="${href}" style="color:${C.muted};text-decoration:underline;">${href}</a></p>`;

const code = (value) => `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:8px 0 24px;"><tr>
  <td bgcolor="${C.well}" style="background:${C.well};border:1px solid ${C.border};border-radius:8px;padding:14px 22px;font-family:${MONO};font-size:28px;line-height:32px;font-weight:600;letter-spacing:0.3em;color:${C.text};">${value}</td>
</tr></table>`;

// Two-column "Label / value" rows for security notices.
const details = (rows) => `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${C.well}" style="margin:0 0 24px;background:${C.well};border:1px solid ${C.border};border-radius:8px;">
${rows.map(([k, v]) => `  <tr><td style="padding:10px 16px;font-family:${FONT};font-size:13px;line-height:20px;color:${C.muted};width:38%;">${k}</td><td style="padding:10px 16px;font-family:${FONT};font-size:13px;line-height:20px;color:${C.text};font-weight:600;word-break:break-all;">${v}</td></tr>`).join("\n")}
</table>`;

const notYou = (text) =>
  `<p style="margin:0;padding-top:20px;border-top:1px solid ${C.border};font-family:${FONT};font-size:13px;line-height:20px;color:${C.muted};">${text}</p>`;

function layout({ title, preheader, body, reason }) {
  return `<!doctype html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light">
<meta name="supported-color-schemes" content="light">
<title>${title}</title>
</head>
<body style="margin:0;padding:0;background:${C.page};-webkit-text-size-adjust:100%;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;mso-hide:all;">${preheader}&#8199;&#65279;&#847;&#8199;&#65279;&#847;&#8199;&#65279;&#847;&#8199;&#65279;&#847;</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${C.page}" style="background:${C.page};">
<tr><td align="center" style="padding:40px 16px;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:520px;">
    <tr><td bgcolor="${C.card}" style="background:${C.card};border:1px solid ${C.border};border-radius:12px;padding:36px 36px 32px;">
      ${logo}
      <h1 style="margin:32px 0 16px;font-family:${FONT};font-size:22px;line-height:30px;font-weight:600;letter-spacing:-0.01em;color:${C.text};">${title}</h1>
      ${body}
    </td></tr>
    <tr><td align="center" style="padding:24px 12px 0;font-family:${FONT};font-size:12px;line-height:18px;color:${C.muted};">
      <p style="margin:0 0 6px;">${reason}</p>
      <p style="margin:0;"><a href="{{ .SiteURL }}" style="color:${C.muted};text-decoration:underline;">Echo</a> &middot; Recordings, transcripts and summaries in one place</p>
    </td></tr>
  </table>
</td></tr>
</table>
</body>
</html>
`;
}

const SENT_TO = `This email was sent to {{ .Email }}.`;
const SECURITY = `You're receiving this security notice because your Echo account settings changed.`;
const IF_NOT_YOU =
  "If you didn't make this change, sign in and review your account right away, or contact your workspace admin.";

// key -> Management API fields mailer_subjects_<key> / mailer_templates_<key>_content
const TEMPLATES = {
  confirmation: {
    group: "authentication",
    label: "Confirm sign up",
    subject: "Confirm your sign up to Echo",
    title: "Confirm your sign up",
    preheader: "One click to finish setting up your Echo account.",
    reason: `${SENT_TO} If you didn't create an Echo account, you can ignore it.`,
    body: `${p(HELLO)}
${p("Welcome to Echo. Confirm <strong>{{ .Email }}</strong> to finish creating your account and open your personal workspace.")}
${button("{{ .ConfirmationURL }}", "Confirm sign up")}
${fallbackLink("{{ .ConfirmationURL }}")}`,
  },
  invite: {
    group: "authentication",
    label: "Invite user",
    subject: "You've been invited to create an Echo account",
    title: "You're invited to Echo",
    preheader: "Accept your invite to create your Echo account.",
    reason: `${SENT_TO} If you weren't expecting an invite, you can ignore it.`,
    body: `${p("Hi there,")}
${p("You've been invited to join Echo, where your calls and meetings become searchable transcripts, summaries and action items.")}
${p("Accept the invite to set up your account as <strong>{{ .Email }}</strong>.")}
${button("{{ .ConfirmationURL }}", "Create account")}
${fallbackLink("{{ .ConfirmationURL }}")}`,
  },
  magic_link: {
    group: "authentication",
    label: "Magic link or OTP",
    subject: "Your Echo sign-in link",
    title: "Sign in to Echo",
    preheader: "Your one-time sign-in link is inside.",
    reason: `${SENT_TO} If you didn't try to sign in, you can ignore it.`,
    body: `${p(HELLO)}
${p("Click the button below to sign in as <strong>{{ .Email }}</strong>. The link works once and expires shortly.")}
${button("{{ .ConfirmationURL }}", "Sign in to Echo")}
${fallbackLink("{{ .ConfirmationURL }}")}`,
  },
  email_change: {
    group: "authentication",
    label: "Change email address",
    subject: "Confirm your new Echo email address",
    title: "Confirm your new email address",
    preheader: "Confirm the change to your Echo sign-in email.",
    reason: `${SENT_TO} If you didn't ask to change your email, you can ignore it and nothing will change.`,
    body: `${p(HELLO)}
${p("We received a request to change the email address on your Echo account.")}
${details([["Current email address", "{{ .Email }}"], ["New email address", "{{ .NewEmail }}"]])}
${button("{{ .ConfirmationURL }}", "Confirm new email address")}
${fallbackLink("{{ .ConfirmationURL }}")}`,
  },
  recovery: {
    group: "authentication",
    label: "Reset password",
    subject: "Reset your Echo password",
    title: "Reset your password",
    preheader: "Use this link to choose a new password.",
    reason: `${SENT_TO} If you didn't ask for a reset, you can ignore it and your password won't change.`,
    body: `${p(HELLO)}
${p("We received a request to reset the password for <strong>{{ .Email }}</strong>. The link works once and expires shortly.")}
${button("{{ .ConfirmationURL }}", "Reset password")}
${fallbackLink("{{ .ConfirmationURL }}")}`,
  },
  reauthentication: {
    group: "authentication",
    label: "Reauthentication",
    subject: "Your Echo reauthentication code",
    title: "Confirm it's you",
    preheader: "Your Echo reauthentication code is {{ .Token }}.",
    reason: `${SENT_TO} If you didn't request a code, you can ignore it.`,
    body: `${p(HELLO)}
${p("Enter this code in Echo to confirm it's you before making a sensitive change. It expires shortly.")}
${code("{{ .Token }}")}
${p("Never share this code. Echo will never ask you for it.")}`,
  },

  // Security: each one sends only after you enable it in Authentication > Emails > Security.
  password_changed_notification: {
    group: "security",
    label: "Password changed",
    subject: "Your Echo password was changed",
    title: "Your password was changed",
    preheader: "The password for your Echo account was just changed.",
    reason: SECURITY,
    body: `${p(HELLO)}
${p("The password for your Echo account <strong>{{ .Email }}</strong> was just changed.")}
${button("{{ .SiteURL }}", "Open Echo")}
${notYou(IF_NOT_YOU)}`,
  },
  email_changed_notification: {
    group: "security",
    label: "Email address changed",
    subject: "Your Echo email address was changed",
    title: "Your email address was changed",
    preheader: "Your Echo account now uses a different email address.",
    reason: SECURITY,
    body: `${p(HELLO)}
${p("The email address on your Echo account was changed.")}
${details([["Previous email address", "{{ .OldEmail }}"], ["New email address", "{{ .Email }}"]])}
${button("{{ .SiteURL }}", "Open Echo")}
${notYou(IF_NOT_YOU)}`,
  },
  phone_changed_notification: {
    group: "security",
    label: "Phone number changed",
    subject: "Your Echo phone number was changed",
    title: "Your phone number was changed",
    preheader: "The phone number on your Echo account was changed.",
    reason: SECURITY,
    body: `${p(HELLO)}
${p("The phone number on your Echo account <strong>{{ .Email }}</strong> was changed.")}
${details([["Previous number", "{{ .OldPhone }}"], ["New number", "{{ .Phone }}"]])}
${button("{{ .SiteURL }}", "Open Echo")}
${notYou(IF_NOT_YOU)}`,
  },
  identity_linked_notification: {
    group: "security",
    label: "Sign-in method linked",
    subject: "A sign-in method was linked to your Echo account",
    title: "Sign-in method linked",
    preheader: "{{ .Provider }} was linked to your Echo account.",
    reason: SECURITY,
    body: `${p(HELLO)}
${p("A new sign-in method was linked to your Echo account <strong>{{ .Email }}</strong>.")}
${details([["Sign-in method", "{{ .Provider }}"]])}
${button("{{ .SiteURL }}", "Open Echo")}
${notYou(IF_NOT_YOU)}`,
  },
  identity_unlinked_notification: {
    group: "security",
    label: "Sign-in method removed",
    subject: "A sign-in method was removed from your Echo account",
    title: "Sign-in method removed",
    preheader: "{{ .Provider }} was removed from your Echo account.",
    reason: SECURITY,
    body: `${p(HELLO)}
${p("A sign-in method was removed from your Echo account <strong>{{ .Email }}</strong>.")}
${details([["Sign-in method", "{{ .Provider }}"]])}
${button("{{ .SiteURL }}", "Open Echo")}
${notYou(IF_NOT_YOU)}`,
  },
  mfa_factor_enrolled_notification: {
    group: "security",
    label: "MFA method added",
    subject: "An MFA method was added to your Echo account",
    title: "MFA method added",
    preheader: "A new MFA method was added to your Echo account.",
    reason: SECURITY,
    body: `${p(HELLO)}
${p("A new multi-factor authentication (MFA) method was added to your Echo account <strong>{{ .Email }}</strong>.")}
${details([["Method", "{{ .FactorType }}"]])}
${button("{{ .SiteURL }}", "Open Echo")}
${notYou(IF_NOT_YOU)}`,
  },
  mfa_factor_unenrolled_notification: {
    group: "security",
    label: "MFA method removed",
    subject: "An MFA method was removed from your Echo account",
    title: "MFA method removed",
    preheader: "An MFA method was removed from your Echo account.",
    reason: SECURITY,
    body: `${p(HELLO)}
${p("A multi-factor authentication (MFA) method was removed from your Echo account <strong>{{ .Email }}</strong>.")}
${details([["Method", "{{ .FactorType }}"]])}
${button("{{ .SiteURL }}", "Open Echo")}
${notYou(IF_NOT_YOU)}`,
  },
};

// Files mirror the dashboard (Authentication > Emails): <group>/<label as slug>.html
const slug = (label) => label.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

rmSync(OUT_DIR, { recursive: true, force: true });
const config = {};
const index = [];
for (const [key, t] of Object.entries(TEMPLATES)) {
  const html = layout(t);
  const file = `${t.group}/${slug(t.label)}.html`;
  mkdirSync(join(OUT_DIR, t.group), { recursive: true });
  writeFileSync(join(OUT_DIR, file), html);
  index.push({ section: t.group === "security" ? "Security" : "Authentication", template: t.label, subject: t.subject, file, api: key });
  config[`mailer_subjects_${key}`] = t.subject;
  config[`mailer_templates_${key}_content`] = html;
}
writeFileSync(join(OUT_DIR, "index.json"), JSON.stringify(index, null, 2) + "\n");
console.log(`Wrote ${index.length} templates to supabase/templates/`);

if (process.argv.includes("--push")) {
  const token = process.env.SUPABASE_ACCESS_TOKEN;
  const ref = process.env.NEXT_PUBLIC_SUPABASE_URL?.match(/https:\/\/([a-z0-9]+)\.supabase\.co/)?.[1];
  if (!token || !ref) {
    console.error("Set SUPABASE_ACCESS_TOKEN and NEXT_PUBLIC_SUPABASE_URL to push.");
    process.exit(1);
  }
  const res = await fetch(`https://api.supabase.com/v1/projects/${ref}/config/auth`, {
    method: "PATCH",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(config),
  });
  // exitCode, not exit(): exiting with fetch handles open crashes Node on Windows.
  if (!res.ok) {
    console.error(`Push failed: ${res.status} ${await res.text()}`);
    process.exitCode = 1;
  } else {
    console.log(`Pushed subjects and templates to project ${ref}.`);
  }
}
