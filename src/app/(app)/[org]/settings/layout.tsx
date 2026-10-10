import { SettingsLayout } from "@/modules/organization/ui/layouts/settings-layout";
export default async function Layout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ org: string }>;
}) {
  const { org } = await params;
  return <SettingsLayout org={org}>{children}</SettingsLayout>;
}
