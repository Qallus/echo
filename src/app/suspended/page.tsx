import { AudioLines, Ban } from "lucide-react";
import { Button } from "@/components/ui/button";
import { COMPANY } from "@/lib/company";

export const metadata = { title: "Account suspended · Echo" };

// Where a suspended account lands. Public, so it works after sign-out.
export default function SuspendedPage() {
  return (
    <main className="flex min-h-svh flex-col items-center justify-center gap-6 bg-background px-4 text-center">
      <span className="flex items-center gap-2"><AudioLines className="size-5" /><span className="text-lg font-semibold tracking-[0.2em]">ECHO</span></span>
      <div className="max-w-sm space-y-2">
        <Ban className="mx-auto size-8 text-destructive" />
        <h1 className="text-2xl font-semibold tracking-tight">Your account is suspended</h1>
        <p className="text-sm text-muted-foreground">
          You can&apos;t use Echo right now. If you think this is a mistake, email{" "}
          <a href={`mailto:${COMPANY.email}`} className="underline underline-offset-4">{COMPANY.email}</a>.
        </p>
      </div>
      <form action="/auth/signout" method="post"><Button type="submit" variant="outline">Sign out</Button></form>
    </main>
  );
}
