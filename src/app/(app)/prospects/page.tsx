import { ComingSoon } from "@/components/shell/coming-soon";

export const metadata = { title: "Prospects · Redial" };

export default function Page() {
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
