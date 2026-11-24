import { ComingSoon } from "@/components/shell/coming-soon";

export const metadata = { title: "Emails · Redial" };

export default function Page() {
  return (
    <ComingSoon
      title="Emails"
      what="Send emails to your contacts with saved templates, and see what was sent."
      points={[
        "Templates you can reuse",
        "Replies come straight to your inbox",
        "A sent log per contact",
        "Schedule an email for later",
      ]}
      meanwhile={{ href: "/templates", label: "See your templates" }}
    />
  );
}
