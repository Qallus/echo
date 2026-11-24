"use client";

import { Suspense } from "react";
import { LinkTabs } from "@/components/shell/link-tabs";

const TABS = [
  { href: "/settings", label: "Profile" },
  { href: "/settings/account", label: "Account" },
  { href: "/settings/notifications", label: "Notifications" },
  { href: "/settings/ai", label: "AI models" },
  { href: "/settings/connections", label: "Connected accounts" },
];

export function SettingsNav() {
  return <Suspense><LinkTabs tabs={TABS} label="Settings" /></Suspense>;
}
