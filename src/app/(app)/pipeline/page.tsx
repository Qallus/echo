import { ComingSoon } from "@/components/shell/coming-soon";

export const metadata = { title: "Pipeline · Redial" };

export default function Page() {
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
