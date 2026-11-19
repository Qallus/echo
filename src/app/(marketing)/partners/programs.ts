// The /partners page: three groups, each with its own programs, and the
// questions each program asks. Program ids match submit_partner_form() and
// become CRM tags (with the group tag: partner-program, careers or
// reseller-program), so staff can filter and target each group.

export type Field =
  | { name: string; label: string; kind: "text"; placeholder?: string; required?: boolean; wide?: boolean }
  | { name: string; label: string; kind: "pick"; options: string[]; wide?: boolean }
  | { name: string; label: string; kind: "chips"; options: string[] };

export type Program = { id: string; label: string; desc: string; fields: Field[] };
export type Group = { id: "partners" | "careers" | "resellers"; label: string; title: string; desc: string; intro: string; programs: Program[] };

const LANGS = ["English", "Spanish", "Mandarin", "Vietnamese", "French", "Other"];
const company = (required = false): Field => ({ name: "company", label: "Company", kind: "text", required });
const website = (label = "Website or profile link"): Field => ({ name: "website", label, kind: "text", placeholder: "https://" });

export const GROUPS: Group[] = [
  {
    id: "partners", label: "Partners", title: "Sell, share or answer for Redial",
    desc: "Resellers, affiliates, influencers and Live Agents.",
    intro: "Earn with Redial by reselling it, sharing it with your audience or answering calls as a Live Agent.",
    programs: [
      { id: "partner-reseller", label: "Reseller", desc: "Sell Redial to homes and businesses you already work with.", fields: [
        company(), website(),
        { name: "sells_to", label: "Who do you sell to? Pick any.", kind: "chips", options: ["Homes and families", "Senior living and caregivers", "Small businesses", "Mid-size businesses", "Enterprises"] },
        { name: "telecom", label: "Do you sell phone or IT services today?", kind: "pick", options: ["Yes", "Some", "Not yet"] },
        { name: "accounts", label: "Accounts you could bring in 90 days", kind: "pick", options: ["1–10", "11–50", "51–200", "200+"] },
      ] },
      { id: "partner-affiliate", label: "Affiliate", desc: "Share your link and earn on every sign-up.", fields: [
        website("Website, newsletter or community link"),
        { name: "channels", label: "Where will you share Redial? Pick any.", kind: "chips", options: ["Website or blog", "Newsletter", "Social media", "Community or association", "Paid ads", "Word of mouth"] },
        { name: "audience_size", label: "Monthly audience", kind: "pick", options: ["Under 1,000", "1,000–10,000", "10,000–100,000", "100,000+"] },
      ] },
      { id: "partner-influencer", label: "Influencer", desc: "Create content about scam protection and smarter phones.", fields: [
        { name: "platform", label: "Main platform", kind: "pick", options: ["YouTube", "TikTok", "Instagram", "Facebook", "LinkedIn", "X", "Podcast", "Other"] },
        website("Your channel or profile link"),
        { name: "followers", label: "Followers", kind: "pick", options: ["Under 10K", "10K–50K", "50K–250K", "250K–1M", "1M+"] },
        { name: "audience", label: "Your audience. Pick any.", kind: "chips", options: ["Seniors and caregivers", "Families", "Small business owners", "Tech", "Personal finance", "Other"] },
      ] },
      { id: "partner-live-agent", label: "Live Agent", desc: "Answer calls for businesses from home, on your schedule.", fields: [
        { name: "experience", label: "Years answering phones", kind: "text", placeholder: "e.g. 4" },
        { name: "hours", label: "Hours a week", kind: "pick", options: ["Under 10", "10–20", "20–30", "30+"] },
        { name: "languages", label: "Languages you speak", kind: "chips", options: LANGS },
      ] },
    ],
  },
  {
    id: "careers", label: "Careers", title: "Join the Redial team",
    desc: "Support, residential sales and business sales.",
    intro: "Help people take back their phones. Tell us about yourself and the role you want.",
    programs: [
      { id: "careers-support", label: "Support team", desc: "Help customers set up Redial and get the most from it.", fields: [
        website("LinkedIn or resume link"),
        { name: "experience", label: "Years in customer support", kind: "text", placeholder: "e.g. 3" },
        { name: "availability", label: "Availability", kind: "pick", options: ["Full time", "Part time", "Contract"] },
        { name: "setup", label: "Work setup", kind: "pick", options: ["Remote", "Chandler, AZ office", "Either"] },
        { name: "languages", label: "Languages you speak", kind: "chips", options: LANGS },
      ] },
      { id: "careers-residential-sales", label: "Residential sales", desc: "Help families protect their parents and home phones.", fields: [
        website("LinkedIn or resume link"),
        { name: "experience", label: "Years in sales", kind: "text", placeholder: "e.g. 5" },
        { name: "availability", label: "Availability", kind: "pick", options: ["Full time", "Part time", "Contract"] },
        { name: "setup", label: "Work setup", kind: "pick", options: ["Remote", "Chandler, AZ office", "Either"] },
        { name: "sold", label: "You've sold. Pick any.", kind: "chips", options: ["Telecom", "Home security", "Solar", "Insurance", "Senior services", "Other"] },
      ] },
      { id: "careers-business-sales", label: "Business sales", desc: "Sell AI receptionists and phone systems to businesses.", fields: [
        website("LinkedIn or resume link"),
        { name: "experience", label: "Years in B2B sales", kind: "text", placeholder: "e.g. 6" },
        { name: "availability", label: "Availability", kind: "pick", options: ["Full time", "Part time", "Contract"] },
        { name: "setup", label: "Work setup", kind: "pick", options: ["Remote", "Chandler, AZ office", "Either"] },
        { name: "segments", label: "You've sold to. Pick any.", kind: "chips", options: ["Small business", "Mid-market", "Enterprise", "SaaS", "Phone systems (UCaaS)", "Other"] },
      ] },
    ],
  },
  {
    id: "resellers", label: "Reseller program", title: "For sales and marketing teams",
    desc: "Outsourced sales, BPO and agency teams that sell at scale.",
    intro: "Put your reps on Redial. Resell it, white-label it, or run campaigns for it, with partner pricing and a dedicated contact.",
    programs: [
      { id: "reseller-program", label: "Sales and BPO teams", desc: "Outsourced sales, call centers and marketing agencies.", fields: [
        company(true), website("Company website"),
        { name: "title", label: "Your role", kind: "text", placeholder: "e.g. VP of Partnerships" },
        { name: "team_size", label: "Sales reps", kind: "pick", options: ["1–10", "11–50", "51–250", "251–1,000", "1,000+"] },
        { name: "regions", label: "Regions you cover", kind: "text", placeholder: "e.g. US and Canada", wide: true },
        { name: "channels", label: "Channels you run. Pick any.", kind: "chips", options: ["Outbound calls", "Inbound calls", "Text", "Email", "Field sales", "Chat"] },
        { name: "markets", label: "Markets you sell to. Pick any.", kind: "chips", options: ["Residential", "Small business", "Mid-market", "Enterprise"] },
        { name: "interest", label: "Interested in. Pick any.", kind: "chips", options: ["Reselling Redial", "White label", "Lead generation", "Live Agent staffing", "Custom AI agents"] },
        { name: "start", label: "When would you start?", kind: "pick", options: ["Right away", "This quarter", "Next quarter", "Just exploring"] },
      ] },
    ],
  },
];

export const GROUP_IDS = GROUPS.map((g) => g.id);
