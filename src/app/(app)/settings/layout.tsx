import { SettingsNav } from "./settings-nav";

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="w-full space-y-6 py-8 sm:py-10 px-4 sm:px-6 lg:px-8 2xl:px-10">
      <h1 className="text-3xl font-semibold tracking-tight">Settings</h1>
      <SettingsNav />
      {children}
    </div>
  );
}
