import { ComingSoon } from "@/components/shell/coming-soon";

export const metadata = { title: "Contacts · Redial" };

export default function Page() {
  return (
    <ComingSoon
      title="Contacts"
      what="Everyone you talk to in one list: calls, texts, recordings and notes on each person."
      points={[
        "List, table, cards, map and calendar views",
        "Import from a spreadsheet",
        "Calls and recordings linked to each contact",
        "Tags and quick actions on many at once",
      ]}
    />
  );
}
