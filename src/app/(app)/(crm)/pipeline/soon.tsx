import { ComingSoon } from "@/components/shell/coming-soon";

// Shown until the workspace CRM SQL has been run.
export const soonMetadata = { title: "Pipeline · Redial" };

export default function Soon() {
  return (
    <ComingSoon
      title="Pipeline"
      what="Track deals from first call to closed, on a board you drag across."
      points={[
        "Your own stages",
        "A checklist for each stage",
        "Deal value and expected close",
        "Linked to contacts and calls",
      ]}
    />
  );
}
