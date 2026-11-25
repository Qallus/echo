import { ComingSoon } from "@/components/shell/coming-soon";

// Shown until the workspace CRM SQL has been run.
export const soonMetadata = { title: "Digital Business Cards · Redial" };

export default function Soon() {
  return (
    <ComingSoon
      title="Digital Business Cards"
      what="A digital business card you share by link or QR code; people who save it become leads."
      points={[
        "Your photo, links and contact buttons",
        "Share by QR code or text",
        "See who opened and saved it",
        "New contacts flow into your Leads",
      ]}
    />
  );
}
