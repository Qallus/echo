// Starter documents for the workspace (TipTap JSON).

type Node = Record<string, unknown>;
const t = (text: string): Node[] => (text ? [{ type: "text", text }] : []);
const h = (level: number, text: string): Node => ({ type: "heading", attrs: { level }, content: t(text) });
const p = (text = ""): Node => ({ type: "paragraph", content: t(text) });
const bullets = (items: string[]): Node => ({ type: "bulletList", content: items.map((i) => ({ type: "listItem", content: [p(i)] })) });
const numbered = (items: string[]): Node => ({ type: "orderedList", content: items.map((i) => ({ type: "listItem", content: [p(i)] })) });
const tasks = (items: string[]): Node => ({ type: "taskList", content: items.map((i) => ({ type: "taskItem", attrs: { checked: false }, content: [p(i)] })) });
const doc = (...content: Node[]) => ({ type: "doc", content });

export const TEMPLATES = [
  { id: "blank", label: "Blank page", icon: "📄", title: "Untitled", content: doc(p()) },
  {
    id: "meeting", label: "Meeting notes", icon: "🗓️", title: "Meeting notes",
    content: doc(h(2, "Attendees"), bullets([""]), h(2, "Agenda"), numbered([""]), h(2, "Notes"), p(), h(2, "Decisions"), bullets([""]), h(2, "Action items"), tasks([""])),
  },
  {
    id: "sop", label: "Process (SOP)", icon: "🧭", title: "Standard operating procedure",
    content: doc(h(2, "Purpose"), p("What this process is for and when to use it."), h(2, "Owner"), p(), h(2, "Steps"), numbered(["", ""]),
      h(2, "Checklist"), tasks([""]), h(2, "Exceptions"), p("What to do when things don't go to plan.")),
  },
  {
    id: "proposal", label: "Proposal", icon: "📑", title: "Proposal",
    content: doc(h(2, "Summary"), p(), h(2, "The problem"), p(), h(2, "Our approach"), p(), h(2, "Scope"), bullets([""]),
      h(2, "Timeline"), bullets([""]), h(2, "Investment"), p(), h(2, "Next steps"), tasks([""])),
  },
  {
    id: "brief", label: "Project brief", icon: "🎯", title: "Project brief",
    content: doc(h(2, "Goal"), p(), h(2, "Success looks like"), bullets([""]), h(2, "Audience"), p(), h(2, "Deliverables"), tasks([""]), h(2, "Risks"), bullets([""])),
  },
];
