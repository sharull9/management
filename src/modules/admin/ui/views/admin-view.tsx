import Link from "next/link";
import { ActionForm } from "@/components/shared/action-form";
import { Field } from "@/components/shared/fields";
import { FormCard } from "@/components/shared/form-card";
import { PageHeading } from "@/components/shared/page-heading";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { requireSuperAdmin } from "@/core/context";
import { db } from "@/core/db";
import { signOutAction } from "@/modules/organization-auth";
import { createTenantAction, tenantStatusAction } from "../../server/actions";

export async function AdminView() {
  await requireSuperAdmin();
  const tenants = await db.tenant.findMany({
    include: {
      organizations: true,
      members: {
        where: { role: "OWNER" },
        include: { user: { select: { name: true, email: true } } },
      },
    },
    orderBy: { createdAt: "desc" },
  });
  return (
    <main className="mx-auto w-full max-w-6xl space-y-6 p-6 md:p-10">
      <PageHeading
        title="Platform administration"
        description="Create tenant accounts and control access to the platform."
      />
      <div className="flex gap-4">
        <Link href="/" className="text-sm underline">
          Organization picker
        </Link>
        <ActionForm action={signOutAction} submit="Sign out" />
      </div>
      <FormCard title="Tenants">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Tenant</TableHead>
              <TableHead>Owner</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Organizations</TableHead>
              <TableHead>Access</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {tenants.map((tenant) => (
              <TableRow key={tenant.id}>
                <TableCell>
                  <p className="font-medium">{tenant.name}</p>
                  <p className="text-xs text-muted-foreground">{tenant.slug}</p>
                </TableCell>
                <TableCell>
                  {tenant.members.map((m) => (
                    <p key={m.id}>
                      {m.user.name}
                      <span className="block text-xs text-muted-foreground">
                        {m.user.email}
                      </span>
                    </p>
                  ))}
                </TableCell>
                <TableCell>
                  <Badge
                    variant={
                      tenant.status === "ACTIVE" ? "secondary" : "destructive"
                    }
                  >
                    {tenant.status}
                  </Badge>
                </TableCell>
                <TableCell>
                  <details>
                    <summary className="cursor-pointer">
                      {tenant.organizations.length} organizations
                    </summary>
                    <ul className="mt-2 space-y-2">
                      {tenant.organizations.map((org) => (
                        <li key={org.id}>
                          {org.name}
                          <span className="block text-xs text-muted-foreground">
                            /{org.slug} · {org.baseCurrency}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </details>
                </TableCell>
                <TableCell>
                  <ActionForm
                    action={tenantStatusAction}
                    submit={tenant.status === "ACTIVE" ? "Suspend" : "Activate"}
                    destructive={tenant.status === "ACTIVE"}
                  >
                    <input type="hidden" name="tenantId" value={tenant.id} />
                    <input
                      type="hidden"
                      name="status"
                      value={
                        tenant.status === "ACTIVE" ? "SUSPENDED" : "ACTIVE"
                      }
                    />
                  </ActionForm>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {!tenants.length && (
          <p className="py-6 text-sm text-muted-foreground">
            No tenants yet. Create the first tenant below.
          </p>
        )}
      </FormCard>
      <FormCard title="Create tenant">
        <ActionForm action={createTenantAction} submit="Create tenant">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Tenant name" name="name" required />
            <Field label="Tenant slug" name="slug" required />
            <Field label="Owner name" name="ownerName" required />
            <Field label="Owner email" name="email" type="email" required />
            <Field
              label="Temporary password (new users only)"
              name="password"
              type="password"
              autoComplete="new-password"
            />
          </div>
          <p className="text-xs text-muted-foreground">
            New users need a password of at least 12 characters. An existing
            account keeps its password.
          </p>
        </ActionForm>
      </FormCard>
    </main>
  );
}
