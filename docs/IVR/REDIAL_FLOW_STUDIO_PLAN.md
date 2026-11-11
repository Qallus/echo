# Redial Call Tree: Visual IVR / Call-Flow Builder

> Status: **Approved v1.1** (2026-11-11). Approval-gated: build one step, show it, stop.
> Built: steps 1-7 (2026-11-11). Tables, flow format and checks (`src/lib/flows/schema.ts`), builder at `/call-tree` with block forms and extensions, the call runner (`src/lib/flows/runner.ts`, step webhook `/api/webhooks/twilio/flow/step`), publish, versions and rollback, and the Calls panel with path highlighting. Tests: `npm test`.
> On calls today: Say, Gather (keys, speech, dial an extension), Split, Business hours, Connect (one, all, in order, whisper), Voicemail, Callback, Set variables, HTTP, Go to another call tree, AI receptionist (hands the call to the existing AI screening), Hang up. Not yet on calls: Human assistant (needs the marketplace), Queue, CRM blocks, SMS / email, per-call recording on Connect, AI intents.

## 0. Decisions (2026-11-11)

1. **Name:** Call Tree (renamed from Flow Studio on 2026-11-11; "Studio" is the Recording Studio). Routes are `/call-tree`.
2. **Canvas:** React Flow (`@xyflow/react`, MIT). Run `npm run lock:linux` after adding it.
3. **Lines:** a flow can run on several lines; each line runs at most one flow (`call_flow_lines.line_id` is the primary key).
4. **Unconnected outputs:** go to the AI receptionist when the line has AI minutes left, otherwise to voicemail (`settings.onUnconnected = "ai_or_voicemail"`, the default). "voicemail" and "goodbye" can be chosen per flow.
5. **Speech matching:** Twilio speech recognition with keyword hints in v1. Unclear speech goes to the AI later, with the AI receptionist block (step 9).

**Changes from the review:**
- **Routes:** dashboard pages have no `/app` prefix, so the routes are `/call-tree`, `/call-tree/[id]`, `/call-tree/[id]/runs` and `/call-tree/[id]/versions`, linked from Calls.
- **Look:** Echo's design tokens (black and neutral primary, light and dark), plus the REDIAL equalizer mark. The mockup's blue and "R" logo are not used.
- **Audio:** Say / Play, Queue and Voicemail use **Recording Studio** clips (`studio_audio`). There is no `call_flow_assets` table. The runner signs a short-lived URL for Twilio at call time.
- **Extensions:** a new `redial_extensions` table (101 → Sales) holds a Directory entry or number, ring time and a voicemail greeting from Studio. Gather can let callers dial an extension at any time, and the desk phones (SIP) will use the same list.
- **Ownership:** a flow belongs to a person. Editing is allowed for the owner, or for anyone with the new **`manage_flows`** line permission on a line the flow runs on. It isn't scoped to a workspace.
- **Block and spam lists** still run before a flow starts. Blocked callers never enter a flow.
- **Publishing and rollback** go through `call_flow_publish()` and `call_flow_rollback()`. Versions can't be edited.
- **Webhook block:** besides "https and public hosts only", check the address the host actually resolves to, so a domain can't point at a private network.
- **Templates:** stored in the app as JSON files until staff need to edit them, so `call_flow_templates` isn't built yet.
> Think "Twilio Studio Flows, built into Redial": drag blocks onto a canvas, connect them, publish, and every call on that line follows the flow. Redial's AI receptionist, human assistants and Echo recording are first-class blocks.

---

## 1. Goals

1. A business owner can build a phone menu ("Press 1 for sales…") in minutes without code.
2. Power users get variables, conditions, webhooks and a JSON view.
3. Every flow is versioned: draft → publish → roll back.
4. Every call shows the exact path it took, step by step.
5. Fits Echo's stack: Next.js route handlers return TwiML, Supabase stores flows and runs, the existing voice gateway runs AI steps.

**Not in v1:** SMS/chat flows, custom code blocks, multi-language TTS voices per block, outbound campaign dialing. (All listed in §12.)

---

## 2. Where it lives

| Route | Screen |
|---|---|
| `/call-tree` | Flow list: name, line(s) attached, status (Draft / Published v4), last edited, calls this week |
| `/call-tree/[id]` | **Call Tree** (canvas builder) |
| `/call-tree/[id]/runs` | Call log for this flow, each run opens the path view |
| `/call-tree/[id]/versions` | Version history, diff, roll back |
| `/admin/redial/call-tree` | Super Admin: all flows, templates, error rates |

Navigation: from Calls in the sidebar (Calls → Call Tree).

---

## 3. Studio layout

```
┌ rail ┬───────────── header: breadcrumb · Flow name · save state · Import · Export · Test call · Publish ─────────────┐
│      ├──────────────┬────────────────────────────────────────────────────────────┬─────────────────────────────┤
│ nav  │ Block library│ Canvas                                                     │ Configuration panel         │
│      │  search      │  tabs: Visual builder · Build with AI · { } JSON           │  selected block's settings  │
│      │  categories  │  nodes + connectors, minimap, zoom/fit, validation pill    │  transitions (where next)   │
│      │              │                                                            │  Apply changes              │
└──────┴──────────────┴────────────────────────────────────────────────────────────┴─────────────────────────────┘
```

- **Canvas:** pan, zoom (25–200%), fit, snap to 8 px grid, minimap, multi-select, copy/paste, undo/redo (50 steps), auto-layout button.
- **Connecting:** drag from a node's output handle (one handle per transition: "Pressed 1", "No answer"…) to another node's input. An output with no connection ends the call politely (configurable per flow).
- **Validation pill** on the canvas: "2 issues" opens a list (unreachable block, missing number, loop with no caller step). Publish is blocked on errors, allowed with warnings.
- **Save state:** drafts autosave to the server every few seconds ("Saved · 2s ago"); a local copy covers offline edits.
- **Test call:** call the draft from the browser (Twilio Voice SDK, already a dependency) or from your phone with a one-time test PIN. The canvas lights up the path live.

---

## 4. Block library (v1)

Each block has **settings** and **named transitions** (outputs).

### Triggers
| Block | Icon | Settings | Transitions |
|---|---|---|---|
| **Incoming call** | `phone-incoming` | Line(s) this flow answers | Next |
| **API / outbound start** | `send` | Webhook key, initial variables | Next |

### Call handling
| Block | Icon | Settings | Transitions |
|---|---|---|---|
| **Say / play** | `volume-2` | Text (TTS voice, language) or audio file; loop count | Next |
| **Gather input** | `keyboard` | Prompt, wait for keypad / speech / both, timeout, max digits, finish key, speech hints | One per matched key or phrase · Speech (any) · No input · No match |
| **Split conditions** | `split` | Ordered rules on any variable (`equals`, `contains`, `matches`, `>`, `<`, `is empty`) | One per rule · No match |
| **Business hours** | `clock` | Weekly schedule, time zone, holiday dates | Open · Closed · Holiday |
| **Connect to extension** | `phone-forwarded` | Number(s) or Directory entry, ring mode (one / all at once / in order), ring seconds, caller ID, whisper message, record call | Connected (hung up after) · No answer · Busy · Failed |
| **AI receptionist** | `sparkles` | Redial agent (name, voice), instructions, goals to capture (name, reason, callback number), intents list, max minutes | One per intent · Hand off to human · Caller hung up · Error |
| **Human assistant** | `headset` | Booked assistant, pool, or "Ring now" match; skills; max per-minute rate | Connected · No one available |
| **Queue / wait** | `list-ordered` | Queue name, hold music, position announcement every N s, max wait | Answered · Timed out · Caller pressed key |
| **Record voicemail** | `circle-dot` | Greeting, max length, transcribe with Echo, notify (push / email / SMS) | Recorded · No recording |
| **Callback request** | `phone-outgoing` | Confirm number, preferred time window | Saved |
| **Run another flow** | `git-branch` | Target flow (published) | (continues in target) |
| **Hang up** | `phone-off` | Optional goodbye message | (end) |

### Data and integrations
| Block | Icon | Settings | Transitions |
|---|---|---|---|
| **Set variables** | `variable` | Key/value list, values support templates | Next |
| **HTTP / webhook** | `webhook` | Method, URL, headers, JSON body, 5 s timeout; response saved to variables | Success · Failed |
| **CRM lookup** | `contact` | Find contact by caller number in Echo CRM | Found · Not found |
| **CRM update** | `user-pen` | Create/update contact, add note, tag | Next |
| **Send SMS / email** | `mail` | To, template, from line | Sent · Failed |

### Echo
- Every flow has a **Recording & consent** setting: off / record all / record after connect, and an optional consent prompt (needed in two-party consent states). Recordings land in Echo with transcript and summary, linked to the run.

---

## 5. Variables and templates

Liquid-style `{{ }}` in any text field.

| Namespace | Examples |
|---|---|
| `trigger.call` | `{{trigger.call.from}}`, `{{trigger.call.to}}`, `{{trigger.call.callerName}}`, `{{trigger.call.city}}` |
| `blocks.<id>` | `{{blocks.gather_menu.digits}}`, `{{blocks.gather_menu.speech}}`, `{{blocks.ai_reception.intent}}`, `{{blocks.lookup.contact.firstName}}`, `{{blocks.webhook_1.body.status}}` |
| `flow.vars` | Values set with **Set variables** |
| `line` | `{{line.name}}`, `{{line.timezone}}` |

The editor offers autocomplete for every variable reachable at that point in the flow.

---

## 6. Flow definition (JSON)

One JSON document per version, validated with zod on save and publish. The **{ } JSON** tab edits it directly; Import / Export uses the same format.

```json
{
  "schema": 1,
  "name": "Main business line",
  "settings": { "timezone": "America/Phoenix", "recording": "after_connect", "onUnconnected": "goodbye" },
  "start": "incoming",
  "nodes": [
    { "id": "incoming", "type": "trigger.call", "label": "Incoming call", "pos": [520, 40],
      "config": {}, "next": { "next": "hours" } },
    { "id": "hours", "type": "hours", "label": "Business hours", "pos": [520, 200],
      "config": { "tz": "America/Phoenix", "week": { "mon": ["08:00", "17:00"] } },
      "next": { "open": "menu", "closed": "ai", "holiday": "ai" } },
    { "id": "menu", "type": "gather", "label": "Gather caller input", "pos": [520, 360],
      "config": { "say": "Thanks for calling. Press 1 for sales, 2 for support, or say a department.",
                  "input": ["dtmf", "speech"], "timeout": 5,
                  "options": [{ "key": "1", "speech": ["sales"], "out": "k1" },
                              { "key": "2", "speech": ["support", "help"], "out": "k2" }] },
      "next": { "k1": "sales", "k2": "support", "noInput": "ai", "noMatch": "menu_retry" } },
    { "id": "sales", "type": "connect", "label": "Sales · Ext 101", "pos": [300, 560],
      "config": { "targets": [{ "directoryId": "…" }], "mode": "one", "ringSeconds": 20 },
      "next": { "noAnswer": "ai", "busy": "ai", "failed": "ai" } }
  ]
}
```

(Trimmed: the `support`, `ai` and `menu_retry` nodes are left out to keep the example short.)

Rules: node ids are slugs, unique; every `next` value is an existing node id; `pos` is only for the canvas.

---

## 7. How calls run (engine)

The engine is a **stateless TwiML state machine** in Echo route handlers. No new long-running service.

1. Twilio hits the existing `/api/webhooks/twilio/redial/voice`. If the line has a **published flow**, Echo creates a `call_flow_runs` row and hands off to the flow runner; otherwise today's Redial behavior runs unchanged.
2. The runner starts at `start` and executes **server-side blocks** immediately (Split, Set variables, Business hours, HTTP, CRM, SMS) in a loop until it reaches a **caller-facing block** (Say, Gather, Connect, Queue, Record, AI). Max 25 server-side hops per request, then it fails safe to the "goodbye" path.
3. The caller-facing block returns TwiML whose `action` URL is `/api/webhooks/twilio/flow/step?run=<id>&node=<id>` (signed by Twilio, verified like the other Twilio webhooks).
4. Twilio posts the result (digits, speech, dial status) to that URL; the runner records the step, picks the transition, and continues from step 2.
5. **AI receptionist**: returns `<Connect><Stream>` to the existing voice gateway with the block's instructions and intents in the signed session. When the agent finishes, the gateway's result webhook updates the live call (`calls(sid).update({ url })`) to the step URL with the chosen intent.
6. **Human assistant / Connect**: use the existing conference + Directory transfer path, so Insider, Audible and Gavel still work mid-flow.
7. Each step writes a `call_flow_run_steps` row (node, transition, timings, inputs with sensitive values masked). The run view replays this on the canvas.

Safety: HTTP blocks only call `https://` public hosts (no private IP ranges), 5 s timeout, 64 KB response cap. Templates are rendered with escaping, never evaluated as code.

---

## 8. Data model (new migration)

All tables: explicit grants, RLS on, access via `private.redial_can(line_id, 'manage_flows')` (new permission) or workspace membership.

| Table | Key columns |
|---|---|
| `call_flows` | id, workspace_id, name, description, draft jsonb, draft_rev int, draft_updated_at, draft_updated_by, published_version_id, created_at |
| `call_flow_versions` | id, flow_id, version int, definition jsonb, note, published_by, published_at (immutable: no update grant) |
| `call_flow_lines` | flow_id, line_id (unique line_id: one active flow per line) |
| `call_flow_runs` | id, flow_id, version_id, line_id, call_sid, from_number, status (`running/completed/failed`), vars jsonb, recording_id, started_at, ended_at |
| `call_flow_run_steps` | id, run_id, seq, node_id, node_type, transition, data jsonb, started_at, duration_ms |
| `call_flow_assets` | id, workspace_id, kind (`audio/hold_music`), storage_path, duration_s |
| `call_flow_templates` | id, name, category, definition (staff-managed) |

Draft saving uses `draft_rev` for optimistic concurrency (two people editing get a "someone else changed this" prompt instead of overwriting).

---

## 9. Build with AI

The **Build with AI** tab takes a plain-English description ("After 5pm, send callers to the AI receptionist; during the day press 1 for sales at ext 101…"). Echo's AI chat (`src/lib/ai/*`) returns a flow JSON using a structured-output schema, the studio validates it and shows a **diff preview** (added / changed / removed blocks) before applying to the draft. It can also explain a selected block or fix validation errors.

---

## 10. Templates (ship with v1)

1. Simple menu (sales / support / operator)
2. Business hours + after-hours AI receptionist
3. AI first, human backup (Redial Assistant)
4. Appointment line (AI books, voicemail fallback)
5. Ring group with voicemail

---

## 11. Build plan (approval-gated steps)

| Step | Deliverable |
|---|---|
| 0 | Approve this plan and the block list |
| 1 | Migration: flows, versions, flow-lines, runs, run steps, assets + RLS + `manage_flows` permission |
| 2 | Flow JSON schema (zod), validator, and unit tests (unreachable nodes, dangling transitions, loops) |
| 3 | Studio shell: header, block library, canvas with **React Flow** (`@xyflow/react`, MIT), config panel, autosave, Import/Export JSON |
| 4 | Block config forms for Say, Gather, Split, Business hours, Connect, Voicemail, Hang up |
| 5 | Runner: route handlers, TwiML for v1 blocks, step webhook, run logging; hook into the Redial voice webhook behind a per-line toggle |
| 6 | Publish, versions, roll back, diff |
| 7 | Runs view: call list + path replay on the canvas |
| 8 | Test call from the browser with live path highlighting |
| 9 | AI receptionist block via the voice gateway; Human assistant block (needs the marketplace) |
| 10 | HTTP, Set variables, CRM, SMS/email blocks |
| 11 | Build with AI tab + templates |
| 12 | Mobile: view flows, turn a flow on/off, see runs (no canvas editing on phones) |

**MVP = steps 1–8** (a working menu builder with real calls and logs).

---

## 12. Later

SMS/chat flows · outbound campaign flows · custom code block (sandboxed) · A/B split · per-block TTS voices and languages · shared sub-flows across workspaces · flow analytics (drop-off per block) · MCP tools (`flow_list`, `flow_publish` as high-risk with confirm).

---

## 13. Decisions needed from Jeremy (answered in §0)

1. Name: **Call Tree** (as in the mockup)?
2. Canvas library: React Flow (`@xyflow/react`) — OK to add the dependency?
3. One published flow per line, or allow a flow on several lines (proposed: yes, several lines, one flow per line)?
4. Default for unconnected outputs: polite goodbye, or send to AI receptionist?
5. Should the Gather block's speech matching use Twilio speech recognition only, or route ambiguous speech to the AI to pick an option?
