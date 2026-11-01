// Summary templates: what a generated summary covers for each kind of
// conversation. Shown on /templates and in the recording's "+" picker; used by
// src/lib/summaries/generate.ts.

export type TemplateCategory = "General" | "Meeting" | "Call" | "Sales" | "Interview" | "Education" | "Consulting" | "Medical" | "Support" | "Faith";

export type Template = {
  id: string;
  name: string;
  bestFor: string;
  category: TemplateCategory;
  sections: string[];
  recommended?: boolean;
  // Extra direction for the model beyond the section list.
  guidance?: string;
};

export const TEMPLATE_CATEGORIES: TemplateCategory[] = ["General", "Meeting", "Call", "Sales", "Interview", "Education", "Consulting", "Medical", "Support", "Faith"];

export const TEMPLATES: Template[] = [
  { id: "adaptive", name: "Adaptive summary", category: "General", recommended: true, bestFor: "Any recording. Echo picks the structure from what was said.",
    sections: ["Overview", "Key points", "Decisions", "Action items with owners", "Open questions"] },
  { id: "meeting-highlights", name: "Meeting highlights", category: "Meeting", recommended: true, bestFor: "Turn a meeting into the moments worth remembering.",
    sections: ["What mattered most", "Notable moments", "Takeaways"], guidance: "Favour 5-8 rich, specific highlights with timestamps." },
  { id: "meeting-minutes", name: "Meeting minutes", category: "Meeting", recommended: true, bestFor: "Clear, structured minutes with actions.",
    sections: ["Attendees", "Agenda items discussed", "Decisions made", "Action items with owners and dates", "Next meeting"] },
  { id: "meeting-secretary", name: "Meeting secretary", category: "Meeting", bestFor: "Detailed notes, topic by topic.",
    sections: ["Purpose", "Discussion by topic", "Agreements", "Follow-ups"] },
  { id: "team-meeting", name: "Team meeting", category: "Meeting", bestFor: "Stand-ups, planning and project syncs.",
    sections: ["Agenda covered", "Updates by person", "Decisions", "Risks", "Action items with owners and dates"] },
  { id: "one-on-one", name: "1:1", category: "Meeting", bestFor: "Manager and report check-ins.",
    sections: ["Wins", "Blockers", "Feedback given and received", "Goals and growth", "Follow-ups"] },
  { id: "reasoning", name: "Reasoning summary", category: "General", recommended: true, bestFor: "Structured summary of the arguments and why.",
    sections: ["Central question", "Positions and reasoning", "Evidence cited", "Conclusion", "Unresolved points"] },
  { id: "quantitative", name: "Quantitative data", category: "General", bestFor: "Pull out every number: prices, dates, metrics.",
    sections: ["Key figures", "Dates and deadlines", "Money and budgets", "Metrics and targets"], guidance: "Each bullet should lead with the number and say what it measures." },
  { id: "intent", name: "Intent analysis", category: "Call", bestFor: "Read what each person wants and how to respond.",
    sections: ["Each speaker's goals", "Concerns and hesitations", "Signals of interest", "Suggested response"] },
  { id: "phone-call", name: "Phone call recap", category: "Call", bestFor: "Quick calls with a customer, vendor or colleague.",
    sections: ["Who and why", "What was agreed", "Details to remember", "Follow-ups"] },
  { id: "sales-call", name: "Sales call", category: "Sales", recommended: true, bestFor: "Discovery, demo and follow-up calls.",
    sections: ["Customer and context", "Pain points", "Budget, authority, timeline", "Objections and answers", "Next steps"] },
  { id: "deal-review", name: "Deal review", category: "Sales", bestFor: "Pipeline and forecast conversations.",
    sections: ["Deal status", "Stakeholders", "Risks", "Mutual plan", "Next steps"] },
  { id: "interview", name: "Interview", category: "Interview", bestFor: "Hiring interviews and candidate screens.",
    sections: ["Candidate background", "Answers by question", "Strengths", "Concerns", "Recommendation"] },
  { id: "user-research", name: "User research", category: "Interview", bestFor: "Customer and usability interviews.",
    sections: ["Participant", "Goals and context", "Pain points (with quotes)", "Feature reactions", "Insights"] },
  { id: "lecture", name: "Lecture or training", category: "Education", bestFor: "Classes, webinars and walkthroughs.",
    sections: ["Topics covered", "Key concepts explained", "Examples", "Questions from the audience", "Study notes"] },
  { id: "study-guide", name: "Study guide", category: "Education", bestFor: "Turn a lesson into review material.",
    sections: ["Summary", "Key terms and definitions", "Main ideas", "Practice questions"] },
  { id: "consulting", name: "Consulting session", category: "Consulting", bestFor: "Client advisory and coaching sessions.",
    sections: ["Client situation", "Recommendations", "Options considered", "Agreed plan", "Homework"] },
  { id: "soap", name: "Clinical visit (SOAP)", category: "Medical", bestFor: "Clinician notes in SOAP format. Review before use.",
    sections: ["Subjective", "Objective", "Assessment", "Plan"], guidance: "Only record what was said. Never invent clinical facts." },
  { id: "customer-support", name: "Support call", category: "Support", bestFor: "Help desk and customer success calls.",
    sections: ["Issue reported", "Steps tried", "Resolution", "Customer sentiment", "Follow-up needed"] },
  { id: "small-group", name: "Small group study", category: "Faith", bestFor: "Bible studies, small groups and discipleship.",
    sections: ["Passage and theme", "Discussion highlights", "Personal takeaways", "Prayer requests", "Next session"] },
  { id: "sermon", name: "Sermon notes", category: "Faith", bestFor: "Messages, talks and teachings.",
    sections: ["Main idea", "Scripture references", "Key points", "Application", "Quotes worth keeping"] },
];

export const findTemplate = (id: string) => TEMPLATES.find((t) => t.id === id) ?? TEMPLATES[0];
