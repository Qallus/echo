import { ComingSoon } from "@/components/shell/coming-soon";

// Shown until the workspace CRM SQL has been run.
export const soonMetadata = { title: "Prospects · Redial" };

export default function Soon() {
  return (
    <ComingSoon
      title="Prospects"
      what="Find businesses to reach out to, check their numbers, and add the good ones as leads."
      points={[
        "Search businesses on the map",
        "Check a phone number before you call",
        "Add many to your leads at once",
        "Notes for each prospect",
      ]}
    />
  );
}
