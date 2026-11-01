// Summary templates: what a generated summary covers for each kind of
// conversation. Shown on /templates and in the recording's "+" picker; used by
// src/lib/summaries/generate.ts.

export type TemplateCategory =
  | "General" | "Meeting" | "Speech" | "Call" | "Interview" | "Medical" | "Sales" | "Consulting" | "Education"
  | "Construction" | "IT & Engineering" | "Legal" | "Real Estate" | "Financial" | "Support" | "Faith" | "Functional";

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

export const TEMPLATE_CATEGORIES: TemplateCategory[] = [
  "General", "Meeting", "Speech", "Call", "Interview", "Medical", "Sales", "Consulting", "Education",
  "Construction", "IT & Engineering", "Legal", "Real Estate", "Financial", "Support", "Faith", "Functional",
];

const CLINICAL = "Only record what was said. Never invent symptoms, findings, doses or diagnoses. The clinician reviews before use.";
const LEGAL = "Record only what was said; don't give legal conclusions. Cite timestamps for important statements.";
const MONEY = "Record only what was said; don't add financial advice. Lead bullets with the figure when there is one.";

export const TEMPLATES: Template[] = [
  // General
  { id: "adaptive", name: "Adaptive summary", category: "General", recommended: true, bestFor: "Any recording. Echo picks the structure from what was said.",
    sections: ["Overview", "Key points", "Decisions", "Action items with owners", "Open questions"] },
  { id: "reasoning", name: "Reasoning summary", category: "General", recommended: true, bestFor: "Structured summary of the arguments and why.",
    sections: ["Central question", "Positions and reasoning", "Evidence cited", "Conclusion", "Unresolved points"] },
  { id: "executive-brief", name: "Executive brief", category: "General", bestFor: "The two-minute version for someone who wasn't there.",
    sections: ["Bottom line", "What changed", "Decisions needed", "Risks", "Next steps"], guidance: "Keep every section to 1-3 bullets. Lead with the conclusion." },
  { id: "detailed-notes", name: "Detailed notes", category: "General", bestFor: "Thorough, topic-by-topic notes of everything covered.",
    sections: ["Topics in order", "Details and examples", "Decisions", "Follow-ups"], guidance: "Be complete rather than brief; keep the order of the conversation." },

  // Meeting
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
  { id: "board-meeting", name: "Board meeting", category: "Meeting", bestFor: "Board and committee meetings with motions and votes.",
    sections: ["Attendance and quorum", "Reports received", "Motions and votes", "Resolutions", "Action items", "Next meeting"],
    guidance: "For each motion, record who moved, who seconded and the result, if stated." },
  { id: "project-kickoff", name: "Project kickoff", category: "Meeting", bestFor: "Starting a project with a shared plan.",
    sections: ["Goals and scope", "Roles and responsibilities", "Timeline and milestones", "Risks and dependencies", "Next steps"] },
  { id: "retrospective", name: "Retrospective", category: "Meeting", bestFor: "Looking back on a project, sprint or event.",
    sections: ["What went well", "What didn't", "Root causes", "Improvements to try", "Owners"] },
  { id: "brainstorm", name: "Brainstorm", category: "Meeting", bestFor: "Idea sessions where you need the best ideas sorted.",
    sections: ["Problem", "Ideas raised", "Themes", "Top picks and why", "Next experiments"] },

  // Speech
  { id: "presentation", name: "Presentation or keynote", category: "Speech", bestFor: "Talks, keynotes and pitches.",
    sections: ["Core message", "Main points", "Stories and data used", "Memorable quotes", "Takeaways"] },
  { id: "podcast", name: "Podcast episode", category: "Speech", bestFor: "Episode summaries and show notes.",
    sections: ["Episode summary", "Guests", "Topics with timestamps", "Notable quotes", "Resources mentioned"] },
  { id: "panel", name: "Panel discussion", category: "Speech", bestFor: "Panels and moderated conversations.",
    sections: ["Panelists", "Questions posed", "Where they agreed", "Where they differed", "Audience Q&A"] },
  { id: "webinar", name: "Webinar recap", category: "Speech", bestFor: "Webinars and online events.",
    sections: ["Agenda", "Key lessons", "Demos shown", "Q&A", "Resources and next steps"] },

  // Call
  { id: "phone-call", name: "Phone call recap", category: "Call", recommended: true, bestFor: "Quick calls with a customer, vendor or colleague.",
    sections: ["Who and why", "What was agreed", "Details to remember", "Follow-ups"] },
  { id: "intent", name: "Intent analysis", category: "Call", bestFor: "Read what each person wants and how to respond.",
    sections: ["Each speaker's goals", "Concerns and hesitations", "Signals of interest", "Suggested response"] },
  { id: "follow-up-call", name: "Follow-up call", category: "Call", bestFor: "Checking in on earlier commitments.",
    sections: ["Previous commitments", "Progress since last call", "New issues", "Updated next steps"] },
  { id: "vendor-call", name: "Vendor or supplier call", category: "Call", bestFor: "Pricing, orders and delivery with suppliers.",
    sections: ["Vendor and products", "Pricing and terms", "Lead times and delivery", "Issues", "Next steps"] },

  // Interview
  { id: "interview", name: "Hiring interview", category: "Interview", bestFor: "Interviews and candidate screens.",
    sections: ["Candidate background", "Answers by question", "Strengths", "Concerns", "Recommendation"] },
  { id: "user-research", name: "User research", category: "Interview", bestFor: "Customer and usability interviews.",
    sections: ["Participant", "Goals and context", "Pain points (with quotes)", "Feature reactions", "Insights"] },
  { id: "reference-check", name: "Reference check", category: "Interview", bestFor: "Calls with a candidate's references.",
    sections: ["Relationship to candidate", "Strengths", "Development areas", "Examples given", "Would they hire again"] },
  { id: "exit-interview", name: "Exit interview", category: "Interview", bestFor: "Learning why someone is leaving.",
    sections: ["Reasons for leaving", "What worked", "What didn't", "Suggestions", "Themes for leadership"] },
  { id: "press-interview", name: "Press or story interview", category: "Interview", bestFor: "Journalism, content and case-study interviews.",
    sections: ["Interviewee and background", "Key claims", "Quotable lines", "Facts to verify", "Follow-up questions"],
    guidance: "Quote exactly as spoken, with timestamps." },

  // Medical
  { id: "soap", name: "Clinical visit (SOAP)", category: "Medical", recommended: true, bestFor: "Clinician notes in SOAP format. Review before use.",
    sections: ["Subjective", "Objective", "Assessment", "Plan"], guidance: CLINICAL },
  { id: "history-physical", name: "History and physical", category: "Medical", bestFor: "New-patient and intake visits.",
    sections: ["Chief complaint", "History of present illness", "Past history and medications", "Exam findings", "Assessment and plan"], guidance: CLINICAL },
  { id: "therapy-dap", name: "Therapy session (DAP)", category: "Medical", bestFor: "Counseling and therapy notes in DAP format.",
    sections: ["Data", "Assessment", "Plan"], guidance: CLINICAL },
  { id: "patient-summary", name: "Patient visit summary", category: "Medical", bestFor: "A plain-language recap to give the patient.",
    sections: ["Why you came in", "What we found", "Your plan", "Medications", "When to follow up or call"],
    guidance: `${CLINICAL} Write for the patient in plain, friendly language.` },
  { id: "care-huddle", name: "Care team huddle", category: "Medical", bestFor: "Shift handoffs and team huddles.",
    sections: ["Patients discussed", "Concerns", "Assignments", "Follow-ups"], guidance: CLINICAL },

  // Sales
  { id: "sales-call", name: "Sales call", category: "Sales", recommended: true, bestFor: "Discovery, demo and follow-up calls.",
    sections: ["Customer and context", "Pain points", "Budget, authority, timeline", "Objections and answers", "Next steps"] },
  { id: "bant", name: "BANT qualification", category: "Sales", bestFor: "Qualify a deal on budget, authority, need and timeline.",
    sections: ["Budget", "Authority", "Need", "Timeline", "Qualification verdict"], guidance: "Say \"not discussed\" for anything the call didn't cover." },
  { id: "meddic", name: "MEDDIC qualification", category: "Sales", bestFor: "Enterprise deals qualified with MEDDIC.",
    sections: ["Metrics", "Economic buyer", "Decision criteria", "Decision process", "Identified pain", "Champion"],
    guidance: "Say \"not discussed\" for anything the call didn't cover." },
  { id: "demo-call", name: "Product demo", category: "Sales", bestFor: "Demos and walkthroughs with prospects.",
    sections: ["Attendees and roles", "Features shown", "Reactions and questions", "Objections", "Next steps"] },
  { id: "deal-review", name: "Deal review", category: "Sales", bestFor: "Pipeline and forecast conversations.",
    sections: ["Deal status", "Stakeholders", "Risks", "Mutual plan", "Next steps"] },
  { id: "field-sales", name: "Field visit report", category: "Sales", bestFor: "In-person customer and site visits.",
    sections: ["Account and location", "Purpose of visit", "Discussion", "Opportunities", "Follow-up actions"] },
  { id: "negotiation", name: "Negotiation", category: "Sales", bestFor: "Pricing and contract negotiations.",
    sections: ["Positions", "Concessions offered", "Terms agreed", "Open items", "Next steps"] },

  // Consulting
  { id: "consulting", name: "Consulting session", category: "Consulting", bestFor: "Client advisory sessions.",
    sections: ["Client situation", "Recommendations", "Options considered", "Agreed plan", "Homework"] },
  { id: "coaching", name: "Coaching session", category: "Consulting", bestFor: "Executive, business and life coaching.",
    sections: ["Focus for the session", "Insights", "Commitments", "Accountability check-in"] },
  { id: "discovery-workshop", name: "Discovery workshop", category: "Consulting", bestFor: "Scoping a new engagement.",
    sections: ["Business goals", "Current state", "Pain points", "Requirements", "Proposed approach"] },
  { id: "strategy-session", name: "Strategy session", category: "Consulting", bestFor: "Planning direction and priorities.",
    sections: ["Situation", "Options", "Trade-offs", "Chosen direction", "Milestones"] },

  // Education
  { id: "lecture", name: "Lecture or training", category: "Education", bestFor: "Classes, trainings and walkthroughs.",
    sections: ["Topics covered", "Key concepts explained", "Examples", "Questions from the audience", "Study notes"] },
  { id: "study-guide", name: "Study guide", category: "Education", bestFor: "Turn a lesson into review material.",
    sections: ["Summary", "Key terms and definitions", "Main ideas", "Practice questions"] },
  { id: "parent-teacher", name: "Parent-teacher conference", category: "Education", bestFor: "Conferences about a student's progress.",
    sections: ["Strengths", "Areas to grow", "Grades and progress", "Support plan at home and school", "Follow-up"] },
  { id: "tutoring", name: "Tutoring session", category: "Education", bestFor: "One-on-one tutoring and lessons.",
    sections: ["Topics covered", "Where the student struggled", "Practice assigned", "Next session focus"] },

  // Construction
  { id: "punch-list", name: "Punch list", category: "Construction", recommended: true, bestFor: "Turn a walkthrough into a punch list.",
    sections: ["Items by area", "Responsible trade", "Priority items", "Target dates"], guidance: "One bullet per item: area, issue, then trade if mentioned." },
  { id: "site-walk", name: "Site walk", category: "Construction", bestFor: "Document site walks and what needs doing.",
    sections: ["Areas walked", "Progress observed", "Issues and hazards", "Action items", "Photos and documents to collect"] },
  { id: "construction-meeting", name: "Construction progress meeting", category: "Construction", bestFor: "Owner, architect and contractor meetings.",
    sections: ["Schedule status", "Work completed", "Upcoming work", "RFIs and submittals", "Safety", "Action items"] },
  { id: "safety-briefing", name: "Safety briefing", category: "Construction", bestFor: "Toolbox talks and safety meetings.",
    sections: ["Topic", "Hazards discussed", "Controls and PPE", "Questions raised", "Attendees"] },
  { id: "estimate-walkthrough", name: "Estimate walkthrough", category: "Construction", bestFor: "Walk a job with the client, then quote it.",
    sections: ["Scope of work", "Measurements and quantities", "Materials and finishes", "Client preferences", "Exclusions and assumptions", "Next steps"],
    guidance: "Keep every measurement and quantity exactly as spoken." },
  { id: "change-order", name: "Change order", category: "Construction", bestFor: "Discussing a change to scope.",
    sections: ["Requested change", "Reason", "Cost impact", "Schedule impact", "Approval status"] },

  // IT & Engineering
  { id: "standup", name: "Daily stand-up", category: "IT & Engineering", bestFor: "Quick team stand-ups.",
    sections: ["Yesterday", "Today", "Blockers"], guidance: "Group bullets by person." },
  { id: "sprint-planning", name: "Sprint planning", category: "IT & Engineering", bestFor: "Planning the next sprint.",
    sections: ["Sprint goal", "Committed work", "Estimates", "Risks", "Owners"] },
  { id: "incident-review", name: "Incident postmortem", category: "IT & Engineering", bestFor: "Blameless reviews after an outage.",
    sections: ["Summary", "Timeline", "Impact", "Root cause", "What went well", "Action items"], guidance: "Blameless: describe systems and decisions, not fault." },
  { id: "design-review", name: "Design review", category: "IT & Engineering", bestFor: "Architecture and technical design reviews.",
    sections: ["Proposal", "Alternatives considered", "Concerns raised", "Decisions", "Follow-ups"] },
  { id: "requirements", name: "Requirements gathering", category: "IT & Engineering", bestFor: "Turning a conversation into requirements.",
    sections: ["Users and goals", "Functional requirements", "Non-functional requirements", "Out of scope", "Open questions"] },

  // Legal
  { id: "legal-intake", name: "Client intake", category: "Legal", bestFor: "First meetings with a new client or matter.",
    sections: ["Client and matter", "Facts as described", "Parties involved", "Key dates", "Documents needed", "Next steps"], guidance: LEGAL },
  { id: "deposition", name: "Deposition summary", category: "Legal", bestFor: "Summarize testimony topic by topic.",
    sections: ["Witness", "Topics examined", "Key admissions", "Inconsistencies", "Exhibits referenced"], guidance: LEGAL },
  { id: "contract-negotiation", name: "Contract negotiation", category: "Legal", bestFor: "Redline and terms discussions.",
    sections: ["Agreement and parties", "Terms discussed", "Agreed changes", "Disputed clauses", "Next draft actions"], guidance: LEGAL },
  { id: "case-strategy", name: "Case strategy meeting", category: "Legal", bestFor: "Internal case planning.",
    sections: ["Issues", "Evidence", "Options", "Risks", "Assignments"], guidance: LEGAL },

  // Real Estate
  { id: "buyer-consultation", name: "Buyer consultation", category: "Real Estate", recommended: true, bestFor: "First meetings with home buyers.",
    sections: ["Buyer goals", "Budget and financing", "Must-haves and nice-to-haves", "Areas of interest", "Timeline", "Next steps"] },
  { id: "listing-appointment", name: "Listing appointment", category: "Real Estate", bestFor: "Meeting sellers about a listing.",
    sections: ["Property details", "Seller goals and timeline", "Pricing discussion", "Marketing plan", "Next steps"] },
  { id: "showing-feedback", name: "Property showing", category: "Real Estate", bestFor: "Capture buyer reactions during a showing.",
    sections: ["Property", "What they liked", "Concerns", "Interest level", "Follow-up"], guidance: "Rate interest from 1-10 based only on what they said, and say why." },
  { id: "property-inspection", name: "Inspection walkthrough", category: "Real Estate", bestFor: "Home inspections and final walkthroughs.",
    sections: ["Findings by area", "Safety issues", "Repairs requested", "Costs mentioned", "Next steps"] },
  { id: "hoa-meeting", name: "HOA or owners' meeting", category: "Real Estate", bestFor: "Homeowner and condo association meetings.",
    sections: ["Attendance", "Financial report", "Issues raised", "Votes", "Action items"] },

  // Financial
  { id: "financial-review", name: "Client financial review", category: "Financial", bestFor: "Advisor and client review meetings.",
    sections: ["Goals", "Current position", "Changes since last review", "Recommendations discussed", "Action items"], guidance: MONEY },
  { id: "earnings-call", name: "Earnings call", category: "Financial", bestFor: "Quarterly results and investor calls.",
    sections: ["Headline results", "Guidance", "Segment highlights", "Analyst questions", "Risks mentioned"], guidance: MONEY },
  { id: "budget-meeting", name: "Budget meeting", category: "Financial", bestFor: "Budget planning and reviews.",
    sections: ["Budget overview", "Line items discussed", "Changes approved", "Open questions", "Owners"], guidance: MONEY },
  { id: "tax-meeting", name: "Tax and accounting meeting", category: "Financial", bestFor: "Meetings with your accountant or bookkeeper.",
    sections: ["Topics discussed", "Deadlines", "Documents to gather", "Questions to follow up", "Next steps"], guidance: MONEY },

  // Support
  { id: "customer-support", name: "Support call", category: "Support", bestFor: "Help desk and customer success calls.",
    sections: ["Issue reported", "Steps tried", "Resolution", "Customer sentiment", "Follow-up needed"] },
  { id: "bug-report", name: "Bug report", category: "Support", bestFor: "Turn a problem call into a bug report.",
    sections: ["Reported problem", "Steps to reproduce", "Expected vs actual", "Environment", "Severity"] },
  { id: "onboarding-call", name: "Customer onboarding", category: "Support", bestFor: "Kickoff and training calls with new customers.",
    sections: ["Customer goals", "Setup completed", "Training covered", "Open questions", "Next milestones"] },

  // Faith
  { id: "small-group", name: "Small group study", category: "Faith", bestFor: "Bible studies, small groups and discipleship.",
    sections: ["Passage and theme", "Discussion highlights", "Personal takeaways", "Prayer requests", "Next session"] },
  { id: "sermon", name: "Sermon notes", category: "Faith", bestFor: "Messages, talks and teachings.",
    sections: ["Main idea", "Scripture references", "Key points", "Application", "Quotes worth keeping"] },
  { id: "prayer-meeting", name: "Prayer meeting", category: "Faith", bestFor: "Prayer gatherings and care meetings.",
    sections: ["Praises", "Prayer requests", "Scripture shared", "Follow-ups"] },
  { id: "church-leadership", name: "Church leadership meeting", category: "Faith", bestFor: "Elder, staff and ministry team meetings.",
    sections: ["Ministry updates", "Decisions", "Care needs", "Upcoming events", "Action items"] },

  // Functional
  { id: "todo-list", name: "To-do list", category: "Functional", recommended: true, bestFor: "Just the tasks: who does what, by when.",
    sections: ["Tasks by owner", "Due dates", "Waiting on others"], guidance: "Start every bullet with a verb." },
  { id: "follow-up-email", name: "Follow-up email", category: "Functional", bestFor: "A ready-to-send recap email.",
    sections: ["Subject line", "Email body", "Attachments to include"], guidance: "Write the email body as short, friendly sentences ready to paste." },
  { id: "quantitative", name: "Quantitative data", category: "Functional", bestFor: "Pull out every number: prices, dates, metrics.",
    sections: ["Key figures", "Dates and deadlines", "Money and budgets", "Metrics and targets"], guidance: "Each bullet should lead with the number and say what it measures." },
  { id: "key-quotes", name: "Key quotes", category: "Functional", bestFor: "The exact words worth keeping.",
    sections: ["Quotes worth keeping", "Context"], guidance: "Quote exactly, with the speaker and timestamp." },
  { id: "timeline", name: "Timeline", category: "Functional", bestFor: "Everything that happened or will happen, in order.",
    sections: ["Events in order", "Dates mentioned", "Upcoming deadlines"] },
  { id: "qa-extract", name: "Questions and answers", category: "Functional", bestFor: "Every question asked and how it was answered.",
    sections: ["Questions and answers", "Unanswered questions"] },
  { id: "decision-log", name: "Decision log", category: "Functional", bestFor: "A record of what was decided and why.",
    sections: ["Decisions", "Who decided", "Rationale", "When to revisit"] },
  { id: "blog-post", name: "Blog post draft", category: "Functional", bestFor: "Turn a talk or conversation into an article.",
    sections: ["Title ideas", "Introduction", "Main sections", "Conclusion", "Call to action"] },
  { id: "social-posts", name: "Social posts", category: "Functional", bestFor: "Posts drawn from what was said.",
    sections: ["LinkedIn post", "Short post for X", "Short caption", "Hashtags"] },
];

export const findTemplate = (id: string) => TEMPLATES.find((t) => t.id === id) ?? TEMPLATES[0];
