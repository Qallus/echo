import { ComingSoon } from "@/components/shell/coming-soon";

export const metadata = { title: "Digital Business Cards · Redial" };

export default function Page() {
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
