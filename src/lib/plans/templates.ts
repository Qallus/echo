import type { Priority } from "./types";

// Starter plans, adapted from Channel-Cast's Plan Builder templates.
// `due` is days after the plan starts.

export type TemplateTask = { title: string; group: string; priority?: Priority; due?: number; milestone?: boolean };
export type PlanTemplate = { id: string; name: string; category: string; description: string; groups: string[]; tasks: TemplateTask[] };

export const PLAN_TEMPLATES: PlanTemplate[] = [
  {
    id: "blank", name: "Blank plan", category: "Simple", description: "To Do, In Progress, Done. Add your own tasks.",
    groups: ["To Do", "In Progress", "Done"], tasks: [],
  },
  {
    id: "simple", name: "Simple plan", category: "Simple", description: "A clean board for everyday work.",
    groups: ["To Do", "In Progress", "Waiting", "Done"],
    tasks: [{ title: "Add your first task", group: "To Do" }, { title: "Set due dates", group: "To Do", priority: "low" }],
  },
  {
    id: "onboarding", name: "Customer onboarding", category: "Customers", description: "Take a new Echo customer from signed to fully set up.",
    groups: ["New customer", "Setup", "Training", "Review", "Active"],
    tasks: [
      { title: "Welcome email and kickoff call", group: "New customer", priority: "high", due: 1 },
      { title: "Create workspace and invite team", group: "Setup", priority: "high", due: 2 },
      { title: "Connect calendar and meeting apps", group: "Setup", due: 3 },
      { title: "Set up summary templates", group: "Setup", due: 4 },
      { title: "Team training session", group: "Training", priority: "high", due: 7 },
      { title: "First-week check-in", group: "Review", due: 7 },
      { title: "30-day review", group: "Review", due: 30, milestone: true },
    ],
  },
  {
    id: "project", name: "Project", category: "Delivery", description: "Phases from discovery to delivery.",
    groups: ["Discovery", "Planning", "In Progress", "Review", "Delivered"],
    tasks: [
      { title: "Define goals and scope", group: "Discovery", priority: "high", due: 3 },
      { title: "Stakeholder interviews", group: "Discovery", due: 5 },
      { title: "Draft the plan and timeline", group: "Planning", priority: "high", due: 7 },
      { title: "Kickoff", group: "In Progress", due: 10 },
      { title: "Internal review", group: "Review", due: 25 },
      { title: "Final delivery", group: "Delivered", priority: "high", due: 30, milestone: true },
    ],
  },
  {
    id: "launch", name: "Marketing launch", category: "Marketing", description: "Plan a launch, campaign or announcement.",
    groups: ["Ideas", "Planning", "Creating", "Scheduled", "Live"],
    tasks: [
      { title: "Goals, audience and message", group: "Planning", priority: "high", due: 3 },
      { title: "Landing page", group: "Creating", due: 10 },
      { title: "Email announcement", group: "Creating", due: 12 },
      { title: "Social posts", group: "Creating", due: 12 },
      { title: "Launch day", group: "Scheduled", priority: "high", due: 14, milestone: true },
      { title: "Results review", group: "Live", due: 21 },
    ],
  },
  {
    id: "software", name: "Software release", category: "Product", description: "From backlog to release.",
    groups: ["Backlog", "Ready", "In Progress", "Code Review", "Testing", "Released"],
    tasks: [
      { title: "Write the spec", group: "Backlog" }, { title: "Break into tasks", group: "Ready" },
      { title: "Build", group: "In Progress", priority: "high" }, { title: "QA pass", group: "Testing" },
      { title: "Ship it", group: "Released", priority: "high", milestone: true },
    ],
  },
  {
    id: "sales", name: "Enterprise deal", category: "Sales", description: "Steps to close and onboard a larger account.",
    groups: ["Discovery", "Proposal", "Security & legal", "Signed", "Rollout"],
    tasks: [
      { title: "Discovery call", group: "Discovery", priority: "high", due: 2 },
      { title: "Demo for the team", group: "Discovery", due: 5 },
      { title: "Send proposal", group: "Proposal", priority: "high", due: 7 },
      { title: "Security questionnaire", group: "Security & legal", due: 14 },
      { title: "Contract signed", group: "Signed", priority: "high", due: 21, milestone: true },
      { title: "Pilot team rollout", group: "Rollout", due: 28 },
    ],
  },
];
