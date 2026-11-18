// "Redial main Greeting": the call tree on (480) 999-9906.
// Run: node docs/Call-Trees/redial-main-greeting.ts  (prints the checks and
// writes redial-main-greeting.json and redial-main-greeting.sql next to it).
//
// Every option sets {{flow.team}}, plays its script (placeholders until the
// real scripts are written), then rings Jeremy's phones (cell + desk phones).
// Answered: logged on the caller's CRM record. Missed: logged (new callers
// become leads), the caller gets a text, jw@redial.si gets an email, and the
// AI receptionist takes the call. Dialing an extension works at any time.

import { writeFileSync } from "node:fs";
import { layoutFlow } from "../../src/lib/flows/blocks.ts";
import { FLOW_SCHEMA, validateFlow, type Flow } from "../../src/lib/flows/schema.ts";

const say = (text: string) => ({ prompt: { text }, loop: 1 });
const team = (id: string, label: string, script: string, next = "ring") => [
  { id: `team_${id}`, type: "set", label: `${label}`, pos: [0, 0], config: { vars: [{ key: "team", value: label }] }, next: { next: `script_${id}` } },
  { id: `script_${id}`, type: "say", label: `${label} script`, pos: [0, 0], config: say(script), next: { next } },
];

const flow = {
  schema: FLOW_SCHEMA,
  name: "Redial main Greeting",
  settings: { timezone: "America/Phoenix", recording: "off", onUnconnected: "ai_or_voicemail", voice: { provider: "gemini", id: "Despina" } },
  start: "incoming",
  nodes: [
    { id: "incoming", type: "trigger.call", label: "Incoming call", pos: [0, 0], config: {}, next: { next: "lookup" } },
    { id: "lookup", type: "crm_lookup", label: "Client lookup", pos: [0, 0], config: {}, next: { found: "greeting", notFound: "greeting" } },
    { id: "greeting", type: "say", label: "Main greeting", pos: [0, 0], config: say("Thank you for calling Redial."), next: { next: "menu" } },
    {
      id: "menu", type: "gather", label: "Main menu", pos: [0, 0],
      config: {
        prompt: { text: "If you know your party's extension, please dial it at any time. For sales, press 1. For support, press 2. To speak to our business team, press 3. To speak to our residential team, press 4. For a dial by name directory, press 5. To speak to an operator, press 0." },
        input: ["dtmf"], timeout: 6, extensions: true,
        options: [
          { out: "sales", key: "1" },
          { out: "support", key: "2" },
          { out: "business", key: "3" },
          { out: "residential", key: "4" },
          { out: "directory", key: "5" },
          { out: "operator", key: "0" },
        ],
      },
      next: { sales: "team_sales", support: "team_support", business: "team_business", residential: "team_residential", directory: "team_directory", operator: "team_operator" },
    },
    ...team("sales", "Sales", "Thanks for your interest in Redial. Connecting you with sales now."),
    ...team("support", "Support", "You've reached Redial support. Connecting you now."),
    ...team("business", "Business", "Connecting you with the Redial business team."),
    ...team("residential", "Residential", "Connecting you with the Redial residential team."),
    ...team("operator", "Operator", "One moment while I connect you."),
    { id: "team_directory", type: "set", label: "Directory", pos: [0, 0], config: { vars: [{ key: "team", value: "Directory" }] }, next: { next: "dial_by_name" } },
    { id: "dial_by_name", type: "directory", label: "Dial by name", pos: [0, 0], config: { prompt: { text: "Please say the name of the person you're trying to reach." }, ringSeconds: 25 }, next: { connected: "log_answered", noAnswer: "log_missed", notFound: "team_operator" } },
    {
      id: "ring", type: "connect", label: "Ring Jeremy", pos: [0, 0],
      config: { targets: [{ owner: true }], mode: "all", ringSeconds: 25, whisper: "Redial {{flow.team}} call.", record: true },
      next: { connected: "log_answered", noAnswer: "log_missed", busy: "log_missed", failed: "log_missed" },
    },
    { id: "log_answered", type: "crm_update", label: "Log answered call", pos: [0, 0], config: { note: "{{flow.team}} call from {{call.from}}, answered.", tags: ["Phone"], createLead: true, interest: "{{flow.team}}" }, next: { next: "goodbye" } },
    { id: "goodbye", type: "hangup", label: "Goodbye", pos: [0, 0], config: {}, next: {} },
    { id: "log_missed", type: "crm_update", label: "Log missed call / new lead", pos: [0, 0], config: { note: "Missed {{flow.team}} call from {{call.from}}. The AI receptionist took it.", tags: ["Phone"], createLead: true, interest: "{{flow.team}}" }, next: { next: "text_caller" } },
    {
      id: "text_caller", type: "message", label: "Missed-call text", pos: [0, 0],
      config: { channel: "sms", to: "{{call.from}}", enabled: true, body: "Thanks for calling Redial! Sorry we missed you. We'll get back to you shortly, or just reply to this text. Reply STOP to opt out." },
      next: { sent: "email_me", failed: "email_me" },
    },
    {
      id: "email_me", type: "message", label: "Email Jeremy", pos: [0, 0],
      config: {
        channel: "email", to: "jw@redial.si", enabled: true, subject: "Missed {{flow.team}} call from {{call.from}}",
        body: "Missed {{flow.team}} call on the Redial main line.\n\nCaller: {{call.callerName}} {{call.from}}\nIn the CRM as: {{flow.contact_name}} {{flow.company}}\nNew lead: {{flow.new_lead}}\n\nThe AI receptionist is taking the call. The recording, transcript and summary will be in Redial.",
      },
      next: { sent: "assistant", failed: "assistant" },
    },
    { id: "assistant", type: "ai", label: "AI receptionist", pos: [0, 0], config: { instructions: "The caller asked for {{flow.team}}. Help them, take a message and offer a callback.", intents: [], maxMinutes: 10 }, next: { handoff: "goodbye", error: "goodbye" } },
  ],
};

const { flow: ok, issues } = validateFlow(flow);
console.log(issues.length ? issues : "No issues");
if (!ok) process.exit(1);
const laid: Flow = layoutFlow(ok);
const json = JSON.stringify(laid);
writeFileSync(new URL("./redial-main-greeting.json", import.meta.url), JSON.stringify(laid, null, 2));

const sql = `-- Redial main Greeting: creates the call tree as a DRAFT, attaches it to
-- (480) 999-9906 and sets the line's cell number to (480) 352-7598.
-- The line keeps working as it does now until you publish the call tree
-- (Call Tree → Redial main Greeting → Publish). Safe to run again: it updates the draft.
-- The call tree speaks in Gemini's Despina: press Publish in Call Tree (not SQL)
-- so the greetings are made into Despina clips in your Recording Studio.
do $$
declare
  v_line uuid;
  v_owner uuid;
  v_flow uuid;
begin
  select id, owner_id into v_line, v_owner from public.redial_lines where number = '+14809999906';
  if v_line is null then raise exception 'No Redial line with the number +14809999906'; end if;

  -- "My phones" in the call tree rings this cell plus the line's desk phones.
  update public.redial_lines set forward_to = '+14803527598' where id = v_line;

  select id into v_flow from public.call_flows where owner_id = v_owner and name = 'Redial main Greeting';
  if v_flow is null then
    insert into public.call_flows (owner_id, name, description, draft, draft_updated_by)
    values (v_owner, 'Redial main Greeting', 'Main menu for (480) 999-9906: sales, support, business, residential, dial by name and operator.', $flow$${json}$flow$::jsonb, v_owner)
    returning id into v_flow;
  else
    update public.call_flows set draft = $flow$${json}$flow$::jsonb where id = v_flow;
  end if;

  insert into public.call_flow_lines (line_id, flow_id) values (v_line, v_flow)
  on conflict (line_id) do update set flow_id = excluded.flow_id;
end $$;
`;
writeFileSync(new URL("./redial-main-greeting.sql", import.meta.url), sql);
console.log(`Wrote ${laid.nodes.length} blocks`);
