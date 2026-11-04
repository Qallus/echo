// The services whose credentials can be set in Admin -> Settings ->
// Integrations. Each field's key is the same name as its Coolify variable, so
// a value set in the dashboard replaces the Coolify one and a blank falls back
// to it. `secret` fields are masked; others (IDs, numbers, addresses) show.

export type Field = { key: string; label: string; secret?: boolean; placeholder?: string; help?: string; required?: boolean };
export type Service = { id: string; name: string; description: string; fields: Field[]; testable?: boolean };

export const SERVICES: Service[] = [
  {
    id: "twilio", name: "Twilio", description: "Texts, calls and the admin browser phone, plus notification texts.", testable: true,
    fields: [
      { key: "TWILIO_ACCOUNT_SID", label: "Account SID", placeholder: "AC…", required: true },
      { key: "TWILIO_AUTH_TOKEN", label: "Auth token", secret: true, required: true },
      { key: "TWILIO_FROM_NUMBER", label: "Phone number", placeholder: "+14805550100", required: true },
      { key: "TWILIO_API_KEY_SID", label: "API key SID (browser phone)", placeholder: "SK…" },
      { key: "TWILIO_API_KEY_SECRET", label: "API key secret (browser phone)", secret: true },
      { key: "TWILIO_TWIML_APP_SID", label: "TwiML App SID (browser phone)", placeholder: "AP…" },
      { key: "ECHO_CALL_LINE", label: "Echo call line number (members' Call & record)", placeholder: "+14805550111", help: "A second Twilio number, not the notification number." },
    ],
  },
  {
    id: "resend", name: "Resend", description: "Every email Echo sends, and inbound email for the Inbox.", testable: true,
    fields: [
      { key: "RESEND_API_KEY", label: "API key", secret: true, placeholder: "re_…", required: true },
      { key: "EMAIL_FROM", label: "From address", placeholder: "Echo <hello@redial.si>", required: true },
      { key: "RESEND_REPLY_TO", label: "Reply-to address", placeholder: "hello@redial.si" },
      { key: "RESEND_WEBHOOK_SECRET", label: "Inbound webhook signing secret", secret: true, placeholder: "whsec_…" },
    ],
  },
  {
    id: "stripe", name: "Stripe", description: "Checkout, subscriptions, refunds and promo codes.", testable: true,
    fields: [
      { key: "STRIPE_SECRET_KEY", label: "Secret key", secret: true, placeholder: "sk_live_… or sk_test_…", required: true },
      { key: "STRIPE_WEBHOOK_SECRET", label: "Webhook signing secret", secret: true, placeholder: "whsec_…", required: true },
    ],
  },
  {
    id: "openai", name: "OpenAI", description: "Transcription (recordings and calls), ChatGPT in Ask Echo, backup summaries.", testable: true,
    fields: [{ key: "OPENAI_API_KEY", label: "API key", secret: true, placeholder: "sk-…", required: true }],
  },
  {
    id: "anthropic", name: "Anthropic", description: "Claude: summaries and Ask Echo.", testable: true,
    fields: [
      { key: "ANTHROPIC_API_KEY", label: "API key", secret: true, placeholder: "sk-ant-…", required: true },
      { key: "ANTHROPIC_WORKSPACE_ID", label: "Workspace ID", placeholder: "wrkspc_…" },
    ],
  },
  { id: "xai", name: "xAI", description: "Grok in Ask Echo and backup summaries.", testable: true, fields: [{ key: "XAI_API_KEY", label: "API key", secret: true, placeholder: "xai-…", required: true }] },
  { id: "gemini", name: "Google Gemini", description: "Gemini in Ask Echo and backup summaries.", testable: true, fields: [{ key: "GEMINI_API_KEY", label: "API key", secret: true, required: true }] },
  { id: "openrouter", name: "OpenRouter", description: "Many models through one key.", testable: true, fields: [{ key: "OPENROUTER_API_KEY", label: "API key", secret: true, placeholder: "sk-or-…", required: true }] },
  { id: "moonshot", name: "Moonshot (Kimi)", description: "Kimi in Ask Echo.", testable: true, fields: [{ key: "MOONSHOT_API_KEY", label: "API key", secret: true, required: true }] },
  {
    id: "linkedin", name: "LinkedIn", description: "Social posting (coming with the Social tab, once LinkedIn approves the app).",
    fields: [
      { key: "LINKEDIN_CLIENT_ID", label: "Client ID", required: true },
      { key: "LINKEDIN_CLIENT_SECRET", label: "Client secret", secret: true, required: true },
    ],
  },
  {
    id: "meta", name: "Meta (Facebook & Instagram)", description: "Social posting (coming with the Social tab, once Meta approves the app).",
    fields: [
      { key: "META_APP_ID", label: "App ID", required: true },
      { key: "META_APP_SECRET", label: "App secret", secret: true, required: true },
    ],
  },
  {
    id: "cron", name: "Scheduled jobs", description: "Protects /api/cron/comms (automations and reminders). Generate one here and put the same value in the Coolify scheduled task.",
    fields: [{ key: "CRON_SECRET", label: "Cron secret", secret: true, required: true }],
  },
  {
    id: "redial", name: "Redial voice gateway", description: "AI call screening. The voice gateway (voice-gateway/ in the repo, its own Coolify service) streams calls to xAI; it uses the xAI key above.",
    fields: [
      { key: "REDIAL_GATEWAY_URL", label: "Gateway URL", placeholder: "wss://voice.redial.si", required: true },
      { key: "REDIAL_GATEWAY_SECRET", label: "Shared secret (same value in the gateway's Coolify variables)", secret: true, required: true },
    ],
  },
  {
    id: "automation", name: "Automation webhooks", description: "Signs webhook calls from Automation rules (X-Echo-Signature: sha256=HMAC of the body), so the receiver can check they came from Echo.",
    fields: [{ key: "AUTOMATION_WEBHOOK_SECRET", label: "Webhook signing secret", secret: true }],
  },
];

export const SECRET_KEYS = new Set(SERVICES.flatMap((s) => s.fields.map((f) => f.key)));
export const fieldFor = (key: string) => SERVICES.flatMap((s) => s.fields).find((f) => f.key === key);
