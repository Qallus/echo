import { ComingSoon } from "@/components/shell/coming-soon";

export const metadata = { title: "Workspace · Redial" };

export default function Page() {
  return (
    <ComingSoon
      title="Workspace"
      what="Shared notes and documents for your team, with comments."
      points={[
        "Docs from templates",
        "Private or shared with the team",
        "Comments on each doc",
        "Link docs to contacts and plans",
      ]}
    />
  );
}
