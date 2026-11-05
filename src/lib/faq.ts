import { FEATURES as R } from "@/lib/redial/features";
import { COMPANY } from "@/lib/company";

// Public FAQ content for /faq, the home page and the pricing page. Only state
// what the product does today; prices live on /pricing, so link there
// instead of quoting them. `tags` are extra search words that don't appear in
// the question or answer.

export type Faq = { q: string; a: string; tags?: string; home?: boolean; pricing?: boolean };
export type FaqTopic = { id: string; title: string; short: string; blurb?: string; items: Faq[] };

export function faqId(q: string) {
  return q.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 80);
}

export const FAQ_TOPICS: FaqTopic[] = [
  {
    id: "start", title: "Getting started", short: "Getting started",
    items: [
      { q: "What are Echo and Redial?", a: "Echo records your calls and meetings and turns them into transcripts, summaries and action items you can search and ask questions about. Redial is Echo's AI call assistant: it answers calls to your Redial number, screens the caller and takes a message or puts the call through, and you can step into any call it's handling." },
      { q: "Do I need both?", a: "No. Echo works on its own. Redial is an add-on to an Echo account, and its calls, messages and summaries show up in the same app." },
      { q: "How do I get started?", a: "Create a free account, choose Business or Personal, and record or upload your first conversation. No card is needed for the Free plan. Add Redial from Pricing when you want it to answer your calls.", tags: "sign up signup register free" },
      { q: "Is there an app for iPhone and Android?", a: "The mobile app is on the way, Android first. Tap the App Store or Google Play button anywhere on the site to join the waitlist and we'll tell you when it's ready. Until then, Echo works in the browser on your phone.", tags: "mobile ios google play app store download" },
    ],
  },
  {
    id: "recording", title: "Echo: recording and transcripts", short: "Recording",
    items: [
      { q: "How do I record a meeting or call?", a: "Press Record in your browser. Echo can record your microphone, or a browser tab you share, which picks up the other people on a video call. You can also upload a recording you already have.", tags: "zoom teams google meet capture", home: true },
      { q: "Which browsers work?", a: "Recording works in Chrome, Edge, Firefox and Safari. The always-on-top pop-out recorder, which stays visible while you're in another window, needs Chrome or Edge on a computer.", tags: "picture in picture pop out", home: true },
      { q: "Which file types can I upload?", a: "MP3, M4A, WAV, AAC, OGG, Opus, FLAC, WebM and MP4.", tags: "upload import audio video format" },
      { q: "How long can a recording be?", a: "Up to about an hour and forty-five minutes for a browser recording, since Echo saves in a compact format. For uploads, files up to 25 MB are transcribed; for long recordings, a compressed format such as M4A or MP3 fits the most time.", tags: "length limit size mb duration", home: true },
      { q: "How long does a transcript take?", a: "Usually a minute or two after the recording ends, a little longer for long recordings. A summary is written automatically once the transcript is ready.", tags: "speed time wait" },
      { q: "Does Echo tell speakers apart?", a: "Yes. Transcripts are labelled by speaker and time-stamped, so you can see who said what and jump to that moment.", tags: "diarization speaker labels timestamps" },
      { q: "Which languages does Echo transcribe?", a: "Echo detects the spoken language automatically, so you don't need to set one. It works best with clear audio in widely spoken languages.", tags: "spanish french language detection" },
      { q: "Can I take notes while I record?", a: "Yes. Type notes as you talk and they're kept alongside the transcript and summary." },
      { q: "Do I have to tell people I'm recording?", a: "Recording laws differ by place. Some require everyone's consent, others only one person's. You're responsible for getting any consent the law requires; see our Terms of Service for more.", tags: "consent legal law permission announce" },
    ],
  },
  {
    id: "ai", title: "Echo: AI", short: "AI",
    items: [
      { q: "What can Echo's AI do?", a: "It writes a summary and action items for each recording, and Ask Echo answers questions in plain words about one recording or your whole library, like “What did we decide about the launch date?”", tags: "summary chat ask questions action items" },
      { q: "Which AI models does Echo use?", a: "Claude by default, with ChatGPT, Gemini, Grok and Kimi available. You can pick the model when you ask a question.", tags: "anthropic openai gpt llm" },
      { q: "Can I use my own AI keys?", a: "Yes. Add your own provider keys in Settings → AI, for yourself or for a Business workspace. They're stored encrypted, and plans used with your own keys cost less.", tags: "byok api key discount" },
      { q: "Is my data used to train AI?", a: "No. We don't use your recordings or transcripts to train AI models, and the AI providers we use don't train on them either.", tags: "privacy training" },
      { q: "Can I use Echo from Claude?", a: "Yes. Echo has a Claude connector, so you can search recordings, read transcripts and summaries, and organize folders from Claude on the web, on your phone, or in Claude Code. It signs in as you and only sees what you can see.", tags: "mcp connector claude code integration", home: true },
    ],
  },
  {
    id: "organize", title: "Echo: workspaces and organizing", short: "Workspaces",
    items: [
      { q: "What's the difference between Personal and Business?", a: "A Personal workspace is only yours. A Business workspace is shared with the people you invite, who can be owners, admins or members. You can move a recording between them at any time, and its audio moves with it.", tags: "team workspace invite members", home: true },
      { q: "How do I find an old conversation?", a: "Search looks through the titles and transcripts of everything you can access. You can also file recordings into folders, or just ask Ask Echo.", tags: "search find folders" },
      { q: "Can I get a summary as a PDF?", a: "Yes. Every recording has a branded summary page you can print or save as a PDF.", tags: "export download report print" },
      { q: "What happens when I delete a recording?", a: "It goes to the trash first, so you can restore it if you change your mind.", tags: "delete trash restore" },
    ],
  },
  {
    id: "redial", title: "Redial: your call assistant", short: "Redial",
    items: [
      { q: "How do calls reach Redial?", a: "Through your Redial number. Give it out directly, or set your cell to forward calls you don't answer to it. We set up the number for you when you add Redial.", tags: "phone number forward forwarding", home: true },
      { q: "Does Redial answer calls to my regular cell number?", a: "Only calls that reach your Redial number, including calls your cell forwards to it. Installing the app doesn't intercept ordinary cell calls.", home: true },
      { q: "What does the assistant say to callers?", a: "It greets them as your assistant, asks who's calling and why, then either puts the call through to you or takes a message and a callback number. It keeps calls short, never pretends to be you, and tells callers to hang up and call 911 in an emergency.", tags: "greeting script message" },
      { q: "Does the assistant say it's an AI?", a: "It introduces itself as your assistant and never claims to be you. If a caller asks whether it's an AI, it says so.", tags: "disclosure robot bot human" },
      { q: "Who gets screened?", a: "You choose: screen unknown callers (the default), screen every call except your VIPs, or turn screening off. VIPs ring straight through, people on your allow list skip screening, and blocked numbers never get through. You can pause screening at any time.", tags: "rules vip block allow list unknown pause" },
      { q: "How do I hear about a call?", a: "Each call ends as a message with a summary, sorted as personal, business, sales or unknown and marked by urgency. You're notified in the app and by email, and you can turn on text and push alerts too.", tags: "notification alert sms email summary" },
      { q: "Does Redial take voicemail?", a: "Yes. When a call goes to voicemail, the message is recorded, stored privately and transcribed, so you can read it instead of listening.", tags: "voicemail transcription" },
      { q: "Are Redial calls recorded?", a: "The assistant keeps a written transcript of each screening call, not audio. Voicemails are recorded as audio and transcribed.", tags: "recording audio transcript" },
      { q: "Can I choose the assistant's voice and name?", a: "Yes. Pick from several voices and give your assistant its own name in your Redial settings.", tags: "voice name customize" },
      { q: "What happens when I run out of screening minutes?", a: "You get a heads-up at 80% and at 100%. Once you're out, unknown callers go to voicemail until your minutes reset or you add a Redial minute pack.", tags: "minutes limit usage" },
    ],
  },
  {
    id: "live", title: "Redial: stepping into a live call", short: "Live calls",
    blurb: "All of these happen on the same call, so the caller never has to hang up and redial.",
    items: [
      { q: "Can I step into a call my assistant is handling?", a: `Yes. Listen in muted, send it private directions, take the call over or transfer it, all on the same call, so the caller never has to redial.`, home: true },
      { q: `What is ${R.insider.name}?`, a: `${R.insider.name} lets you listen to a call live while the assistant talks. The phone system mutes you, so nobody on the call can hear you.`, tags: "listen live monitor" },
      { q: `What is ${R.audible.name}?`, a: `${R.audible.name} lets you type private directions to the assistant during a call, like “ask which project this is about.” It works them in at the next natural pause, and the caller never sees them.`, tags: "guide whisper directions coach" },
      { q: `What is ${R.gavel.name}?`, a: `${R.gavel.name} hands the call to you. The assistant steps away and you're talking to the caller on the same call.`, tags: "take over takeover" },
      { q: `What is ${R.directory.name}?`, a: `${R.directory.name} transfers the caller to someone in your saved list, or to another number. The person you transfer to hears who's calling and presses 1 to take the call.`, tags: "transfer forward warm" },
      { q: `What is ${R.mirror.name}?`, a: `${R.mirror.name} is a silent assistant for calls you're on. It listens, suggests answers from your notes and past calls, and drafts follow-up texts and emails. Nothing is sent until you approve it, and the caller can't hear it.`, tags: "copilot suggestions draft follow up" },
    ],
  },
  {
    id: "sharing", title: "Redial: sharing a line", short: "Sharing a line",
    items: [
      { q: "Can someone else help manage my calls?", a: "Yes. Share your line with a teammate or family member by email, and choose exactly what they can do: read summaries, read transcripts, change your screening rules, listen live, guide the assistant, take over, transfer, or use Mirror.", tags: "share assistant team family permissions" },
      { q: "Who can see my calls?", a: "Only you, unless you share a line. Then each person gets only what you choose, and you can change or remove their access at any time.", home: true },
    ],
  },
  {
    id: "billing", title: "Plans and billing", short: "Billing",
    blurb: "Current prices are on the Pricing page.",
    items: [
      { q: "Is there a free plan?", a: "Yes. The Free plan includes transcription minutes every month and needs no card. Upgrade to Pro or Business when you need more.", tags: "free price cost", home: true },
      { q: "How does Business pricing work?", a: "You pay per seat, and the price per seat drops as your team grows: seats 1–5, 6–20 and 21+ are each billed at a lower rate. Add seats any time; they're charged pro rata.", tags: "seats team per user", pricing: true },
      { q: "Is there a discount for paying yearly?", a: "Yes. Annual plans cost less than paying month to month.", tags: "annual yearly" },
      { q: "How much is Redial?", a: "Redial is an add-on with its own monthly or annual price and a set of screening minutes. See Pricing for the current price, and Redial minute packs for busy months.", tags: "price cost add-on bolt-on" },
      { q: "What happens to unused minutes?", a: "Plan minutes reset each month. Minute packs stay valid for 12 months and are used after your plan's minutes run out.", tags: "rollover packs", pricing: true },
      { q: "Can I change or cancel my plan?", a: "Yes. Switch plans, change seats, update your card or cancel any time from Billing. Cancelling keeps your plan until the end of the period you've paid for.", tags: "cancel downgrade upgrade", pricing: true },
      { q: "Do you offer refunds?", a: "Fees aren't normally refundable, except where the law requires. If something went wrong with a charge, write to us and we'll look into it. See the Terms of Service for details.", tags: "refund money back", pricing: true },
      { q: "How do I pay?", a: "By card through Stripe. Echo never sees or stores your full card number.", tags: "payment card stripe credit" },
      { q: "Can you help us set up Echo?", a: "Yes. Onboarding, template packs and custom integrations are available as services on the Pricing page, or book a call with us.", tags: "onboarding setup services help" },
    ],
  },
  {
    id: "privacy", title: "Privacy and security", short: "Privacy",
    items: [
      { q: "Where is my audio stored?", a: "In a private storage bucket. Every request is checked against your workspace membership, so files are only reachable by people who belong to that workspace.", tags: "storage files", home: true },
      { q: "Who can hear my recordings?", a: "Recordings in your Personal workspace are only yours. Recordings in a Business workspace are shared with the people you invite to it.", tags: "access privacy", home: true },
      { q: "Is my data encrypted?", a: "Yes. Data is encrypted in transit over HTTPS and at rest by our storage provider. AI keys you add are encrypted separately.", tags: "encryption security https" },
      { q: "Where is my data hosted?", a: "In the United States. Some service providers, such as AI and transcription providers, may process data in other countries; the Privacy Policy lists them.", tags: "region location hosting" },
      { q: "How do I delete my account?", a: `Email ${COMPANY.email} from the address on your account. We delete your content within 30 days. Security logs are kept for up to 12 months.`, tags: "delete account close data removal gdpr" },
    ],
  },
  {
    id: "support", title: "Account and support", short: "Support",
    items: [
      { q: "How do I contact you?", a: `Use the contact form, email ${COMPANY.email} or call ${COMPANY.phone}. We reply within one business day.`, tags: "support help email phone" },
      { q: "Can I talk to someone before I sign up?", a: "Yes. Book a call with us from the Book page and pick a time that suits you.", tags: "demo sales call book meeting" },
      { q: "How often will you text me if I join the app waitlist?", a: "As often as you choose: big news only, monthly, weekly or every update, about the topics you pick. Reply STOP to stop or HELP for help at any time.", tags: "sms text messages frequency waitlist" },
    ],
  },
];

export const ALL_FAQ = FAQ_TOPICS.flatMap((t) => t.items);
