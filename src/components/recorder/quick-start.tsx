"use client";

import { Mic, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useRecorder } from "./recorder-provider";

// Record / Upload buttons for empty states.
export function QuickStart() {
  const { openStart, openUpload, status } = useRecorder();
  return (
    <div className="flex flex-wrap justify-center gap-2">
      <Button onClick={() => openStart("meeting")} disabled={status !== "idle"}><Mic /> Record a meeting</Button>
      <Button variant="outline" onClick={() => openUpload()}><Upload /> Upload audio</Button>
    </div>
  );
}
