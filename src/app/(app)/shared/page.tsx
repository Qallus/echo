import { Users } from "lucide-react";
import { SharedList, type SharedRow } from "@/components/shared/shared-list";
import { requireUser } from "@/lib/data";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Shared with me · Redial" };

// Recordings other people shared with your email address. Read-only.
export default async function SharedWithMePage() {
  await requireUser();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("shared_with_me");
  const rows = (data ?? []) as SharedRow[];

  return (
    <div className="w-full space-y-6 py-10 px-4 sm:px-6 lg:px-8 2xl:px-10">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Shared with me</h1>
        <p className="mt-1 text-sm text-muted-foreground">Recordings other people shared with your email address. You can read them, but not change them.</p>
      </div>
      {error && <p className="text-sm text-destructive">{error.message}</p>}
      {!error && rows.length === 0 && (
        <div className="rounded-xl border border-dashed p-10 text-center">
          <Users className="mx-auto size-6 text-muted-foreground" />
          <p className="mt-3 font-medium">Nothing shared with you yet</p>
          <p className="mt-1 text-sm text-muted-foreground">When someone shares a recording with your email, it shows up here.</p>
        </div>
      )}
      {rows.length > 0 && <SharedList rows={rows} />}
    </div>
  );
}
