import { redirect } from "next/navigation";
import { LAST_STEP } from "@/lib/redial/setup";
import { loadSetup } from "@/lib/redial/setup-data";

// /setup picks up where you left off.
export default async function SetupPage() {
  const { setup } = await loadSetup();
  redirect(`/setup/${Math.min(Math.max(setup.step, 1), LAST_STEP)}`);
}
