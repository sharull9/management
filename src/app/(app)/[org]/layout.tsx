import { OrganizationLayout } from "@/modules/organization/ui/layouts/organization-layout";
export const instant = false;
export default async function Layout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ org: string }>;
}) {
  const { org } = await params;
  return <OrganizationLayout org={org}>{children}</OrganizationLayout>;
}
