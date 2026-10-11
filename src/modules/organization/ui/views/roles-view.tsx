import { EmptyState } from "@/components/shared/empty-state";
import { FormCard } from "@/components/shared/form-card";
import { PageHeading } from "@/components/shared/page-heading";
import { assertPermission, requireOrgContext } from "@/core/context";
import { db } from "@/core/db";
import { deleteRoleAction } from "../../server/role-actions";
import { RecordDeleteForm } from "../components/record-delete-form";
import { RoleForm } from "../components/role-form";

export async function RolesView({ org }: { org: string }) {
  const ctx = await requireOrgContext(org);
  assertPermission(ctx, "roles.manage");
  const roles = await db.role.findMany({
    where: { tenantId: ctx.tenant.id },
    include: { _count: { select: { members: true } } },
    orderBy: { name: "asc" },
  });
  return (
    <>
      <PageHeading
        title="Roles and permissions"
        description="Roles are shared across the tenant. Permission keys include future project, procurement, asset and accounting modules."
      />
      <div className="space-y-4">
        {roles.map((role) => (
          <FormCard key={role.id} title={role.name}>
            <details>
              <summary className="cursor-pointer text-sm">
                {role.permissions.length} permissions · {role._count.members}{" "}
                members · Edit role
              </summary>
              <div className="space-y-4 pt-6">
                <RoleForm
                  org={org}
                  role={{
                    id: role.id,
                    name: role.name,
                    description: role.description ?? "",
                    permissions: role.permissions,
                  }}
                />
                <RecordDeleteForm
                  id={role.id}
                  action={deleteRoleAction.bind(null, org)}
                  submit="Delete role"
                />
              </div>
            </details>
          </FormCard>
        ))}
      </div>
      {!roles.length && <EmptyState title="No custom roles yet." />}
      <FormCard title="Create role">
        <RoleForm org={org} />
      </FormCard>
    </>
  );
}
