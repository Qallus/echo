"use client";

import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";

// Print, or "Save as PDF" in the browser's print dialog.
export function PrintButton() {
  return <Button size="sm" onClick={() => window.print()}><Printer /> Print or save as PDF</Button>;
}
