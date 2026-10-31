// Developer backlog values (enforced by the database) and their labels.
// Used by the /backlog page and the MCP backlog tools.

export const KINDS = ["feature", "bug", "content", "design", "question", "task"] as const;
export const AREAS = ["frontend", "dashboard", "admin", "api", "mcp", "database", "other"] as const;
export const PRIORITIES = ["low", "normal", "high", "urgent"] as const;
export const STATUSES = ["new", "planned", "in_progress", "review", "done", "wont_do"] as const;
export const OPEN_STATUSES = ["new", "planned", "in_progress", "review"] as const;
export const SOURCES = ["dashboard", "claude", "claude_code", "mcp"] as const;

export type Kind = (typeof KINDS)[number];
export type Area = (typeof AREAS)[number];
export type Priority = (typeof PRIORITIES)[number];
export type Status = (typeof STATUSES)[number];

export const STATUS_LABEL: Record<Status, string> = {
  new: "New", planned: "Planned", in_progress: "In progress", review: "Review", done: "Done", wont_do: "Won't do",
};
export const AREA_LABEL: Record<Area, string> = {
  frontend: "Frontend", dashboard: "Dashboard", admin: "Admin", api: "API", mcp: "MCP", database: "Database", other: "Other",
};
export const SOURCE_LABEL: Record<string, string> = {
  dashboard: "Echo", claude: "Claude", claude_code: "Claude Code", mcp: "Connector",
};
export const label = (v: string) => v.charAt(0).toUpperCase() + v.slice(1).replace("_", " ");
