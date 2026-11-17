// A Live Agent as staff see it in Admin → Live Agents (client + server).

export type AdminClipRow = { id: string; title: string; transcript: string | null; url: string; durationS: number | null; status: string; aiVoice: boolean };

export type AdminAgent = {
  id: string; userId: string | null; email: string | null; phone: string | null; handle: string; name: string; headline: string; bio: string | null;
  city: string; region: string; timeZone: string; lat: number | null; lng: number | null; years: number;
  languages: string[]; industries: string[]; skills: string[]; equipment: string[]; workspace: string[]; experience: { title: string; detail?: string }[];
  perMinuteCents: number | null; hourlyCents: number | null; retainerCents: number | null; retainerHours: number | null;
  availability: Record<string, [string, string]>; availableNow: boolean; avatarUrl: string | null;
  status: string; isDemo: boolean; rating: number | null; reviewCount: number; engagementCount: number;
  reviewNote: string | null; submittedAt: string | null; approvedAt: string | null; createdAt: string; updatedAt: string;
  samples: AdminClipRow[];
};

// Staff wording for each status ("Blocked" is the suspended status).
export const ADMIN_STATUS: Record<string, { label: string; tone: "outline" | "secondary" | "success" | "destructive" }> = {
  pending: { label: "To review", tone: "secondary" },
  live: { label: "Live", tone: "success" },
  draft: { label: "Draft", tone: "outline" },
  paused: { label: "Paused", tone: "outline" },
  suspended: { label: "Blocked", tone: "destructive" },
  archived: { label: "Archived", tone: "outline" },
};

export const initials = (name: string) =>
  name.replace(/\./g, "").split(/\s+/).filter(Boolean).map((p) => p[0]).join("").slice(0, 2).toUpperCase() || "?";
