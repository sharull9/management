import { Suspense } from "react";
import Loading from "@/app/(app)/loading";
import { ActionForm } from "@/components/action-form";
import { Field, SelectField } from "@/components/fields";
import { FormCard } from "@/components/form-card";
import { PageHeading } from "@/components/page-heading";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { removeMemberAction, saveMemberAction } from "@/server/actions";
import { assertPermission, requireOrgContext } from "@/server/context";
import { db } from "@/server/db";

async function MembersPage({ params }: { params: Promise<{ org: string }> }) {
  const { org } = await params;
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
  return (
    <>
      <PageHeading
        title="Members"
        description="Add an existing account by email, or create a new account with a temporary password. Base roles grant administrator access; custom roles grant individual permissions."
      />
      <FormCard title="Organization members">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Member</TableHead>
              <TableHead>Base role</TableHead>
              <TableHead>Custom role</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {members.map((member) => (
              <TableRow key={member.id}>
                <TableCell>
                  {member.user.name}
                  <span className="block text-xs text-muted-foreground">
                    {member.user.email}
                  </span>
                </TableCell>
                <TableCell>{member.role}</TableCell>
                <TableCell>{member.customRole?.name ?? "None"}</TableCell>
                <TableCell>
                  <details>
                    <summary className="cursor-pointer text-sm">
                      Edit access
                    </summary>
                    <div className="min-w-56 space-y-4 pt-4">
                      <ActionForm
                        action={saveMemberAction.bind(null, org)}
                        submit="Update member"
                      >
                        <input
                          type="hidden"
                          name="email"
                          value={member.user.email}
                        />
                        <input
                          type="hidden"
                          name="name"
                          value={member.user.name}
                        />
                        <input type="hidden" name="password" value="" />
                        <SelectField
                          label="Base role"
                          name="role"
                          defaultValue={member.role}
                        >
                          <option value="member">Member</option>
                          <option value="admin">Admin</option>
                          <option value="owner">Owner</option>
                        </SelectField>
                        <SelectField
                          label="Custom role"
                          name="roleId"
                          defaultValue={member.roleId ?? ""}
                        >
                          <option value="">None</option>
                          {roles.map((r) => (
                            <option key={r.id} value={r.id}>
                              {r.name}
                            </option>
                          ))}
                        </SelectField>
                      </ActionForm>
                      <ActionForm
                        action={removeMemberAction.bind(null, org)}
                        submit="Remove member"
                        destructive
                      >
                        <input type="hidden" name="id" value={member.id} />
                      </ActionForm>
                    </div>
                  </details>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </FormCard>
      <FormCard title="Add member">
        <ActionForm
          action={saveMemberAction.bind(null, org)}
          submit="Add member"
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Email" name="email" type="email" required />
            <Field label="Full name (new users)" name="name" />
            <Field
              label="Temporary password (new users)"
              name="password"
              type="password"
              autoComplete="new-password"
            />
            <SelectField label="Base role" name="role" defaultValue="member">
              <option value="member">Member</option>
              <option value="admin">Admin</option>
              <option value="owner">Owner</option>
            </SelectField>
            <SelectField label="Custom role" name="roleId" defaultValue="">
              <option value="">None</option>
              {roles.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </SelectField>
          </div>
          <p className="text-xs text-muted-foreground">
            New users need a name and a password of at least 12 characters.
            Existing passwords are kept.
          </p>
        </ActionForm>
      </FormCard>
    </>
  );
}

export default function Page(props: Parameters<typeof MembersPage>[0]) {
  return (
    <Suspense fallback={<Loading />}>
      <MembersPage {...props} />
    </Suspense>
  );
}
