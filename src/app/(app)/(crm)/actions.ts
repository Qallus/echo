"use server";

import { cookies } from "next/headers";
import { listWorkspaces } from "@/lib/data";
import { WS_COOKIE } from "@/lib/crm/scope";

// Which workspace the CRM pages show (one of yours; RLS checks every row too).
export async function pickCrmWorkspace(id: string): Promise<void> {
  const mine = await listWorkspaces();
  if (!mine.some((w) => w.id === id)) return;
  (await cookies()).set(WS_COOKIE, id, { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax", httpOnly: true });
}
