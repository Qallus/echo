import { ComingSoon } from "@/components/shell/coming-soon";

export const metadata = { title: "Leads · Redial" };

export default function Page() {
  return (
    <ComingSoon
      title="Leads"
      what="People who might become customers, with a status for each and the next step."
      points={[
        "New, contacted, qualified and lost",
        "Turn a lead into a client in one click",
        "Leads from your business cards and call tree",
        "Follow-up reminders",
      ]}
    />
  );
}
