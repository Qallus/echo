"use client";

import Link from "next/link";
import { useTransition } from "react";
import { MoreHorizontal, Pencil, Star, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { deleteDesign, setDefaultDesign } from "@/lib/designs/actions";

export function DesignActions({ id, isDefault }: { id: string; isDefault: boolean }) {
  const [pending, start] = useTransition();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button variant="ghost" size="icon-sm" aria-label="Design options" disabled={pending} />}><MoreHorizontal /></DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem render={<Link href={`/templates/designs/${id}`} />}><Pencil /> Edit</DropdownMenuItem>
        {!isDefault && <DropdownMenuItem onClick={() => start(async () => { await setDefaultDesign(id); })}><Star /> Make default</DropdownMenuItem>}
        <DropdownMenuItem onClick={() => { if (confirm("Delete this design?")) start(async () => { await deleteDesign(id); }); }}><Trash2 /> Delete</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
