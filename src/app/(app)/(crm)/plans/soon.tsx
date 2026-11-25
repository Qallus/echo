import { ComingSoon } from "@/components/shell/coming-soon";

// Shown until the workspace CRM SQL has been run.
export const soonMetadata = { title: "Plans · Redial" };

export default function Soon() {
  return (
    <ComingSoon
      title="Plans"
      what="Plans with checklists for projects and follow-ups, shared with your team."
      points={[
        "Groups and tasks with due dates",
        "Assign tasks to teammates",
        "Board, list and calendar views",
        "Turn action items from a call into tasks",
      ]}
      meanwhile={{ href: "/calendar", label: "Open your calendar" }}
    />
  );
}
