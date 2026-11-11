// Redial feature names and per-line capabilities, in one place. The live-call
// names (Insider, Audible, Gavel, Directory, Mirror) are working names and
// will probably change: rename them here.

export const FEATURES = {
  insider: { name: "Insider", action: "Listen live", detail: "Hear the live call. Your microphone isn't sent." },
  audible: { name: "Audible", action: "Guide agent", detail: "Send your assistant private directions while it talks." },
  gavel: { name: "Gavel", action: "Take over", detail: "Remove the assistant and talk to the caller on the same call." },
  directory: { name: "Directory", action: "Transfer", detail: "Connect the caller to an approved person or number." },
  mirror: { name: "Mirror", action: "Assist me", detail: "Your assistant listens silently while you talk and suggests what you need." },
} as const;

// Mirrors redial_line_grants.capabilities. `live: true` ones do nothing until
// their live-call control ships, so the sharing screen doesn't offer them yet.
export const CAPABILITIES = [
  { id: "read_summary", label: "See calls and summaries", live: false },
  { id: "read_transcript", label: "Read transcripts and play voicemails", live: false },
  { id: "manage_rules", label: "Change rules, lists and the assistant", live: false },
  { id: "monitor_live", label: `${FEATURES.insider.name}: listen to live calls`, live: false },
  { id: "takeover_live", label: `${FEATURES.gavel.name}: take over calls from the assistant`, live: false },
  { id: "direct_agent", label: `${FEATURES.audible.name}: guide the assistant during calls`, live: false },
  { id: "transfer_call", label: `${FEATURES.directory.name}: transfer calls to saved numbers`, live: false },
  { id: "manage_directory", label: `${FEATURES.directory.name}: edit the transfer list`, live: false },
  { id: "dial_custom_destination", label: `${FEATURES.directory.name}: transfer to a one-time number`, live: false },
  { id: "mirror", label: `${FEATURES.mirror.name}: get suggestions during calls`, live: false },
  { id: "manage_flows", label: "Call Tree: edit phone menus, extensions and call flows", live: true },
] as const;
export type Capability = (typeof CAPABILITIES)[number]["id"];
export const SHAREABLE = CAPABILITIES.filter((c) => !c.live);
export const capabilityLabel = (id: string) => CAPABILITIES.find((c) => c.id === id)?.label ?? id;
