// Suggested names for the Redial assistant. Each matches one of the live
// voices (VOICES in ./types), so picking a name can pick its voice too. People
// can still type any name they like. The public site rotates through these
// wherever it names the assistant.

export const AGENT_NAMES = [
  { name: "Ara", voice: "ara", gender: "female" },
  { name: "Rex", voice: "rex", gender: "male" },
  { name: "Eve", voice: "eve", gender: "female" },
  { name: "Leo", voice: "leo", gender: "male" },
] as const;

export const DEFAULT_AGENT = AGENT_NAMES[0];

// For places that can't rotate (page titles, search snippets): the token
// "{agent}" becomes "your assistant", capitalized at the start of a sentence.
export function plainAgent(text: string) {
  return text.replace(/(^|[.!?]\s+)?\{agent\}/g, (_, start?: string) => (start !== undefined ? `${start}Your assistant` : "your assistant"));
}
