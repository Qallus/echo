// Sample recordings for trying Echo before real capture exists.
// Inserted into the user's workspace by loadSampleData() (src/lib/actions.ts).
import type { Highlight, Recording, Segment, Summary } from "@/lib/types";

type Content = { segments: Segment[]; highlights: Highlight[]; summary: Summary | null };

// folderId holds a folder NAME here; the loader maps it to a real folder id.
const RECORDINGS: (Omit<Recording, "id" | "workspaceId" | "createdBy"> & { key: string })[] = [
  { key: "r1", title: "Stealth EQ Mode Workflow: Single-Tap Capture vs. Disclosure", source: "phone_call", status: "generated", durationSec: 16, createdAt: "2026-10-28T13:49:49-07:00", folderId: null, deletedAt: null },
  { key: "r2", title: "Planning: MJG, Steward, and Forge Life Group Systems", source: "meeting", status: "generated", durationSec: 6032, createdAt: "2026-10-27T15:57:24-07:00", folderId: "Clients", deletedAt: null },
  { key: "r3", title: "SIG In-Office Time", source: "meeting", status: "none", durationSec: 5, createdAt: "2026-10-27T14:03:10-07:00", folderId: null, deletedAt: null },
  { key: "r4", title: "Button Workflow and MCP Sync Latency", source: "phone_call", status: "generated", durationSec: 221, createdAt: "2026-10-27T13:58:24-07:00", folderId: "Internal", deletedAt: null },
  { key: "r5", title: "Untitled desktop capture", source: "desktop", status: "processing", durationSec: 5, createdAt: "2026-10-27T12:48:11-07:00", folderId: null, deletedAt: null },
  { key: "r6", title: "ChannelCast Integration Setup and Verification", source: "phone_call", status: "generated", durationSec: 53, createdAt: "2026-10-26T12:11:56-07:00", folderId: "Clients", deletedAt: null },
  { key: "r7", title: "ChannelCast API, URL, and Webhook Review", source: "meeting", status: "generated", durationSec: 150, createdAt: "2026-10-26T12:09:21-07:00", folderId: "Clients", deletedAt: null },
  { key: "r8", title: "Product Demo Upload", source: "upload", status: "none", durationSec: 4865, createdAt: "2026-10-26T09:17:13-07:00", folderId: null, deletedAt: null },
  { key: "r9", title: "Old voicemail", source: "phone_call", status: "none", durationSec: 42, createdAt: "2026-10-20T09:00:00-07:00", folderId: null, deletedAt: "2026-10-25T10:00:00-07:00" },
];


const planning: Content = {
  segments: [
    { speaker: "Jeremy Waters", startSec: 0, text: "Let's start with the homepage. I think Steward is too prominent in the hero right now." },
    { speaker: "Mike Gothier", startSec: 14, text: "Agreed. The blueprint is the product. Steward should support it, not lead it." },
    { speaker: "Jeremy Waters", startSec: 31, text: "Then the next piece is groups. Churches need an admin role that controls who can create and join groups." },
    { speaker: "Mike Gothier", startSec: 52, text: "Church approval has to be the control layer. Nothing goes live without it." },
    { speaker: "Jeremy Waters", startSec: 78, text: "On assessments, we should deliver results through conversation instead of a static report." },
    { speaker: "Mike Gothier", startSec: 101, text: "I can build five more assessments from existing material so we have enough to promote and test." },
    { speaker: "Jeremy Waters", startSec: 129, text: "Still open: blog design, and how we label AI images. I'll research embedding image metadata automatically." },
    { speaker: "Mike Gothier", startSec: 156, text: "I'll talk to Kyle about information-sharing terms between Forge Life and MJG." },
  ],
  highlights: [
    { startSec: 14, text: "The blueprint is the product; Steward supports it." },
    { startSec: 52, text: "Church approval is the required control layer." },
    { startSec: 101, text: "Five more assessments for promotion and testing." },
  ],
  summary: {
    template: "Detailed summary",
    model: "Claude",
    overview:
      "Planning session covering the MJG homepage direction, church-controlled groups, conversational assessment results, and information sharing between Forge Life and MJG.",
    keyPoints: [
      "Homepage emphasis shifts from Steward to the Stewardship Blueprint.",
      "MJG groups support discovery and facilitator workflows; church approval is the control layer.",
      "Steward should deliver assessment results through conversation.",
      "Assessments are the acquisition and conversion path.",
      "Blog design and AI-image labeling remain open.",
    ],
    actionGroups: [
      {
        owner: "Jeremy Waters",
        role: "developer / technical collaborator",
        items: [
          { id: "a1", text: "Move Steward AI off the MJG homepage hero and elevate the stewardship blueprint content.", done: false },
          { id: "a2", text: "Add the church admin user role and define its initial access around group control.", done: false },
          { id: "a3", text: "Research an automated workaround for AI-image labeling or embedded image metadata.", done: false },
          { id: "a4", text: "Prepare a proposed pay structure for a combined development and growth role.", done: false },
        ],
      },
      {
        owner: "Mike Gothier",
        role: "platform founder / ministry leader",
        items: [
          { id: "a5", text: "Build five more assessments from existing material for promotion and testing.", done: false },
          { id: "a6", text: "Discuss Forge Life and MJG information-sharing terms with Kyle.", done: false },
        ],
      },
    ],
    mindMap: {
      root: "Planning: MJG, Steward, Forge Life",
      branches: [
        "Groups support discovery & facilitators",
        "Church approval is the control layer",
        "Homepage: blueprint over Steward",
        "Assessment results via conversation",
        "Steward infra, Stripe, dashboard agents",
        "Blog design & AI-image labeling open",
        "Forge Life ↔ MJG info sharing",
        "Assessments drive acquisition",
        "Action items",
      ],
    },
  },
};

function generic(r: Omit<Recording, "id" | "workspaceId" | "createdBy"> & { key: string }): Content {
  const done = r.status === "generated";
  return {
    segments: done
      ? [
          { speaker: "Speaker 1", startSec: 0, text: `Quick notes on "${r.title}".` },
          { speaker: "Speaker 2", startSec: Math.min(8, r.durationSec), text: "Sounds good, let's capture next steps." },
        ]
      : [],
    highlights: [],
    summary: done
      ? {
          template: "Adaptive summary",
          model: "Claude",
          overview: `Short discussion about ${r.title.toLowerCase()}.`,
          keyPoints: ["Topic reviewed and next steps agreed."],
          actionGroups: [{ owner: "Jeremy Waters", role: "owner", items: [{ id: `${r.key}-1`, text: "Follow up on the items discussed.", done: false }] }],
          mindMap: { root: r.title, branches: ["Topic reviewed", "Next steps", "Action items"] },
        }
      : null,
  };
}


export const SAMPLE_FOLDERS = ["Clients", "Internal"];

export const SAMPLE = RECORDINGS.map((r) => ({ recording: r, ...(r.key === "r2" ? planning : generic(r)) }));
