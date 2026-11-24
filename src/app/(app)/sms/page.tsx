import { ComingSoon } from "@/components/shell/coming-soon";

export const metadata = { title: "SMS · Redial" };

export default function Page() {
  return (
    <ComingSoon
      title="SMS"
      what="Text customers and contacts from your own Redial number, with every conversation in one place."
      points={[
        "Two-way texts from your Redial line",
        "Search contacts or type any number",
        "Schedule a text for later",
        "Opt-outs (STOP) handled for you",
      ]}
      meanwhile={{ href: "/calls?tab=phone", label: "Open the Dialpad" }}
    />
  );
}
