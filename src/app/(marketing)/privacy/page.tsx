import Link from "next/link";
import { COMPANY, LegalDoc, type LegalSection } from "@/components/marketing/legal-doc";

export const metadata = {
  title: "Privacy Policy · Echo",
  description: "What Echo collects, why, who processes it, and the choices you have.",
  alternates: { canonical: "/privacy" },
};

const UPDATED = "October 31, 2026";

const PROVIDERS = [
  { name: "Supabase", purpose: "Database, sign-in and file storage (your audio, transcripts and account data)" },
  { name: "OpenAI", purpose: "Transcription, and Ask Echo answers when you choose ChatGPT" },
  { name: "Anthropic", purpose: "Summaries, and Ask Echo answers when you choose Claude" },
  { name: "xAI", purpose: "Ask Echo answers when you choose Grok" },
  { name: "Stripe", purpose: "Payments, invoices and receipts" },
  { name: "Resend", purpose: "Account and notification emails" },
  { name: "Twilio", purpose: "SMS notifications and verification codes" },
  { name: "Our hosting provider", purpose: "Runs the Echo web app (virtual private server)" },
];

const sections: LegalSection[] = [
  {
    id: "who",
    title: "Who we are",
    body: (
      <p>{COMPANY.product} is operated by {COMPANY.name} (&quot;we&quot;, &quot;us&quot;). This policy explains how we handle personal information when you use {COMPANY.site} and its apps, connectors and APIs (the &quot;Service&quot;). For recordings you make, you decide what is recorded and why: we process that content for you.</p>
    ),
  },
  {
    id: "collect",
    title: "What we collect",
    body: (
      <ul>
        <li><strong>Account and profile:</strong> name, email, password (stored hashed by our auth provider), and anything you add to your profile, such as photo, job title, company, phone, time zone and location.</li>
        <li><strong>Your content:</strong> audio you record or upload, transcripts, speaker labels, notes, highlights, summaries, action items and chat messages.</li>
        <li><strong>Notification details:</strong> extra email addresses, phone numbers and browser push subscriptions you add, and your preferences.</li>
        <li><strong>Billing:</strong> plan, orders and invoices. Card details go straight to Stripe; we never see or store full card numbers.</li>
        <li><strong>Usage and device:</strong> sign-in times, actions taken by connected apps (for example, which Echo tools Claude used), IP address, browser type, and error logs.</li>
      </ul>
    ),
  },
  {
    id: "use",
    title: "How we use it",
    body: (
      <ul>
        <li>to provide the Service: record, store, transcribe, summarize, search and share your content;</li>
        <li>to send the emails, texts and push notifications you&apos;ve chosen, plus essential account messages;</li>
        <li>to process payments, prevent fraud and abuse, and keep the Service secure;</li>
        <li>to support you, and to improve the Service using aggregated, de-identified usage information;</li>
        <li>to meet legal obligations.</li>
      </ul>
    ),
  },
  {
    id: "ai",
    title: "AI processing",
    body: (
      <p>To transcribe and summarize, we send the relevant audio or text to the AI provider for that task (listed below), under terms that prohibit using it to train their models. <strong>We do not use your recordings or transcripts to train AI models.</strong></p>
    ),
  },
  {
    id: "sharing",
    title: "Who we share it with",
    body: (
      <>
        <p>We don&apos;t sell or rent personal information, and we don&apos;t share it for cross-context behavioral advertising. We share it only:</p>
        <ul>
          <li>with people you choose: members of a Business workspace you record into, and anyone you send a share link, embed or file to;</li>
          <li>with apps you connect, such as Claude through the Echo connector;</li>
          <li>with the service providers below, who process it for us under contract;</li>
          <li>if required by law, or to protect rights and safety, or as part of a merger or sale of our business (with notice to you).</li>
        </ul>
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left"><tr><th className="px-3 py-2 font-medium">Provider</th><th className="px-3 py-2 font-medium">What for</th></tr></thead>
            <tbody className="divide-y">
              {PROVIDERS.map((p) => <tr key={p.name}><td className="px-3 py-2 align-top font-medium">{p.name}</td><td className="px-3 py-2">{p.purpose}</td></tr>)}
            </tbody>
          </table>
        </div>
      </>
    ),
  },
  {
    id: "cookies",
    title: "Cookies",
    body: (
      <p>We use only the cookies needed to keep you signed in and secure. We don&apos;t use advertising or cross-site tracking cookies. Your browser may store small preferences locally (for example, a collapsed sidebar).</p>
    ),
  },
  {
    id: "retention",
    title: "How long we keep it",
    body: (
      <ul>
        <li>Your content stays until you delete it. Items in Trash can be restored until you permanently delete them.</li>
        <li>When your account is deleted, we delete your content and profile within 30 days. Backups are overwritten on a regular schedule.</li>
        <li>We keep billing records as long as tax and accounting laws require, and security logs for up to 12 months.</li>
      </ul>
    ),
  },
  {
    id: "security",
    title: "Security",
    body: (
      <p>Data is encrypted in transit (HTTPS) and at rest by our storage provider. Access is controlled per workspace by database rules, so recordings are only reachable by people in that workspace. No system is perfectly secure; if a breach affects your personal information, we&apos;ll notify you as the law requires.</p>
    ),
  },
  {
    id: "rights",
    title: "Your choices and rights",
    body: (
      <>
        <p>You can view and edit your profile, change notification settings, export recordings and delete recordings in the app. To delete your whole account, email us. Depending on where you live (for example California, the EU or the UK), you may also have the right to access, correct, delete or port your personal information, and to object to or restrict certain processing.</p>
        <p>To make a request, email <a href={`mailto:${COMPANY.email}`}>{COMPANY.email}</a>. We&apos;ll verify your identity and reply within 30 days. We won&apos;t discriminate against you for exercising your rights. If a request concerns a recording that someone else made in their workspace, we&apos;ll refer you to them, because they control that content.</p>
      </>
    ),
  },
  {
    id: "sms",
    title: "Text messages",
    body: (
      <p>If you add a phone number, we text it only a verification code and the notifications you turn on. Message and data rates may apply. Reply STOP to opt out, or HELP for help. We don&apos;t share your phone number for marketing.</p>
    ),
  },
  {
    id: "international",
    title: "International transfers",
    body: (
      <p>We&apos;re based in the United States, and our providers may process data in the U.S. and other countries. Where required, we rely on appropriate safeguards such as standard contractual clauses.</p>
    ),
  },
  {
    id: "children",
    title: "Children",
    body: <p>The Service isn&apos;t for anyone under 18, and we don&apos;t knowingly collect personal information from children.</p>,
  },
  {
    id: "changes",
    title: "Changes",
    body: (
      <p>We&apos;ll post updates here and change the date above. If a change is material, we&apos;ll tell you by email or in the Service before it takes effect. See also our <Link href="/terms">Terms of Service</Link>.</p>
    ),
  },
  {
    id: "contact",
    title: "Contact",
    body: <p>{COMPANY.name} · {COMPANY.address} · <a href={COMPANY.phoneHref}>{COMPANY.phone}</a> · <a href={`mailto:${COMPANY.email}`}>{COMPANY.email}</a></p>,
  },
];

export default function PrivacyPage() {
  return (
    <LegalDoc
      title="Privacy Policy"
      updated={UPDATED}
      intro={<p>We collect what&apos;s needed to run Echo, never sell it, and never use your recordings to train AI.</p>}
      sections={sections}
    />
  );
}
