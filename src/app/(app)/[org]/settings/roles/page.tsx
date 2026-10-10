import { Suspense } from "react";
import Loading from "@/app/(app)/loading";
import { ActionForm } from "@/components/action-form";
import { Field } from "@/components/fields";
import { FormCard } from "@/components/form-card";
import { PageHeading } from "@/components/page-heading";
import { permissionGroups } from "@/lib/permissions";
import { deleteRoleAction, saveRoleAction } from "@/server/actions";
import { assertPermission, requireOrgContext } from "@/server/context";
import { db } from "@/server/db";

function Permissions({ selected = [] }: { selected?: string[] }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {Object.entries(permissionGroups).map(([group, permissions]) => (
        <fieldset key={group} className="space-y-2 rounded-lg border p-4">
          <legend className="px-2 text-sm font-medium">{group}</legend>
          {Object.entries(permissions).map(([key, label]) => (
            <label key={key} className="flex items-start gap-2 text-sm">
              <input
                className="mt-1 accent-primary"
                type="checkbox"
                name="permissions"
                value={key}
                defaultChecked={selected.includes(key)}
              />
              {label}
            </label>
          ))}
        </fieldset>
      ))}
    </div>
  );
}
async function RolesPage({ params }: { params: Promise<{ org: string }> }) {
  const { org } = await params;
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
                <ActionForm action={saveRoleAction.bind(null, org)}>
                  <input type="hidden" name="id" value={role.id} />
                  <Field
                    label="Role name"
                    name="name"
                    defaultValue={role.name}
                    required
                  />
                  <Field
                    label="Description"
                    name="description"
                    defaultValue={role.description ?? ""}
                  />
                  <Permissions selected={role.permissions} />
                </ActionForm>
                <ActionForm
                  action={deleteRoleAction.bind(null, org)}
                  submit="Delete role"
                  destructive
                >
                  <input type="hidden" name="id" value={role.id} />
                </ActionForm>
              </div>
            </details>
          </FormCard>
        ))}
      </div>
      {!roles.length && (
        <p className="text-sm text-muted-foreground">No custom roles yet.</p>
      )}
      <FormCard title="Create role">
        <ActionForm
          action={saveRoleAction.bind(null, org)}
          submit="Create role"
        >
          <Field label="Role name" name="name" required />
          <Field label="Description" name="description" />
          <Permissions />
        </ActionForm>
      </FormCard>
    </>
  );
}

export default function Page(props: Parameters<typeof RolesPage>[0]) {
  return (
    <Suspense fallback={<Loading />}>
      <RolesPage {...props} />
    </Suspense>
  );
}
