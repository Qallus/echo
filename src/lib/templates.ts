// Summary templates: what a generated summary covers for each kind of
// conversation. Shown on /templates; used when summaries are generated.

export type Template = { id: string; name: string; bestFor: string; sections: string[] };

export const TEMPLATES: Template[] = [
  {
    id: "adaptive", name: "Adaptive summary", bestFor: "Any recording. Echo picks the structure from what was said.",
    sections: ["Overview", "Key points", "Decisions", "Action items with owners", "Open questions"],
  },
  {
    id: "sales-call", name: "Sales call", bestFor: "Discovery, demo and follow-up calls.",
    sections: ["Customer and context", "Pain points", "Budget, authority, timeline", "Objections and answers", "Next steps"],
  },
  {
    id: "one-on-one", name: "1:1", bestFor: "Manager and report check-ins.",
    sections: ["Wins", "Blockers", "Feedback given and received", "Goals and growth", "Follow-ups"],
  },
  {
    id: "team-meeting", name: "Team meeting", bestFor: "Stand-ups, planning and project syncs.",
    sections: ["Agenda covered", "Updates by person", "Decisions", "Risks", "Action items with owners and dates"],
  },
  {
    id: "interview", name: "Interview", bestFor: "Hiring interviews and candidate screens.",
    sections: ["Candidate background", "Answers by question", "Strengths", "Concerns", "Recommendation"],
  },
  {
    id: "customer-support", name: "Support call", bestFor: "Help desk and customer success calls.",
    sections: ["Issue reported", "Steps tried", "Resolution", "Customer sentiment", "Follow-up needed"],
  },
  {
    id: "lecture", name: "Lecture or training", bestFor: "Classes, webinars and walkthroughs.",
    sections: ["Topics covered", "Key concepts explained", "Examples", "Questions from the audience", "Study notes"],
  },
];
