import { toOptions } from "@/components/shared/form/enum-options";
import { FormCard } from "@/components/shared/form-card";
import { PageHeading } from "@/components/shared/page-heading";
import { assertPermission, requireOrgContext } from "@/core/context";
import { db } from "@/core/db";
import { MemberForm } from "../components/member-form";
import { type MemberRow, MembersTable } from "../components/members-table";
export async function MembersView({ org }: { org: string }) {
  const ctx = await requireOrgContext(org);
  assertPermission(ctx, "members.manage");
  const [members, roles] = await Promise.all([
    db.member.findMany({
      where: { organizationId: ctx.org.id },
      include: {
        user: { select: { name: true, email: true } },
        customRole: true,
      },
      orderBy: { createdAt: "asc" },
    }),
    db.role.findMany({
      where: { tenantId: ctx.tenant.id },
      orderBy: { name: "asc" },
    }),
  ]);
  const roleOptions = toOptions(roles);
  return (
    <>
      <PageHeading
        title="Members"
        description="Add an existing account by email, or create a new account with a temporary password. Base roles grant administrator access; custom roles grant individual permissions."
      />
      <FormCard title="Organization members">
        <MembersTable
          org={org}
          roles={roleOptions}
          data={members.map((member) => ({
            id: member.id,
            name: member.user.name,
            email: member.user.email,
            role: member.role as MemberRow["role"],
            roleId: member.roleId,
            customRole: member.customRole?.name ?? null,
          }))}
        />
      </FormCard>
      <FormCard title="Add member">
        <MemberForm org={org} customRoles={roleOptions} />
      </FormCard>
    </>
  );
}
