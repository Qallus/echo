import { ComingSoon } from "@/components/shell/coming-soon";

// Shown until the workspace CRM SQL has been run.
export const soonMetadata = { title: "Clients · Redial" };

export default function Soon() {
  return (
    <ComingSoon
      title="Clients"
      what="Your customers, with their deals, calls and recordings together."
      points={[
        "Every client in one list",
        "Calls, texts and recordings on each client",
        "Open deals and plans per client",
        "Map view of where they are",
      ]}
    />
  );
}
