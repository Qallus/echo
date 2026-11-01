import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AvatarUpload } from "@/components/profile/avatar-upload";
import { ProfileSummary } from "@/components/profile/profile-card";
import { getMyProfile } from "@/lib/data";
import { ProfileForm } from "./profile-form";

export const metadata = { title: "Profile · Settings · Echo" };

export default async function ProfileSettingsPage() {
  const profile = await getMyProfile();
  const timeZones = Intl.supportedValuesOf("timeZone");

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_16rem]">
      <Card>
        <CardHeader>
          <CardTitle>Profile</CardTitle>
          <CardDescription>How teammates see you across Echo: in the team list, on shared recordings and when you&apos;re mentioned.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <AvatarUpload userId={profile.id} name={profile.fullName} email={profile.email} src={profile.avatarUrl} />
          <ProfileForm profile={profile} timeZones={timeZones} />
        </CardContent>
      </Card>

      <div className="space-y-2 lg:sticky lg:top-6 lg:self-start">
        <p className="text-xs font-medium text-muted-foreground">Preview</p>
        <Card><CardContent><ProfileSummary person={{ ...profile, phone: profile.phoneVisible ? profile.phone : null, details: profile.details.filter((d) => d.shared) }} /></CardContent></Card>
        <p className="text-xs text-muted-foreground">What teammates see when they hover your name.</p>
      </div>
    </div>
  );
}
