import Link from "next/link";
import { redirect } from "next/navigation";
import { ActionForm } from "@/components/shared/action-form";
import { EmptyState } from "@/components/shared/empty-state";
import { FormCard } from "@/components/shared/form-card";
import { PageHeading } from "@/components/shared/page-heading";
import {
  Item,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemTitle,
} from "@/components/ui/item";
import { listAccessibleOrgs, requireUser } from "@/core/context";
import { db } from "@/core/db";
import { signOutAction } from "@/modules/organization-auth/server/actions";
import { OrganizationForm } from "../components/organization-form";

export async function OrganizationPickerView() {
  const user = await requireUser();
  const [orgs, memberships, countries, states] = await Promise.all([
    listAccessibleOrgs(user.id),
    db.tenantMember.findMany({
      where: { userId: user.id, tenant: { status: "ACTIVE" } },
      include: {
        tenant: { include: { _count: { select: { organizations: true } } } },
      },
    }),
    db.country.findMany({ orderBy: { name: "asc" } }),
    db.state.findMany({ orderBy: { name: "asc" } }),
  ]);
  if (user.role === "admin" && !memberships.length) redirect("/admin");
  return (
    <main className="mx-auto w-full max-w-4xl p-6 py-12">
      <PageHeading
        title={`Welcome, ${user.name}`}
        description="Choose an organization to open its workspace."
      />
      <div className="mb-8 flex items-center gap-4">
        <ActionForm action={signOutAction} submit="Sign out" />
        {user.role === "admin" && (
          <Link href="/admin" className="text-sm underline">
            Platform administration
          </Link>
        )}
      </div>
      <ItemGroup>
        {orgs.map((org) => (
          <Item key={org.id} variant="outline" asChild>
            <Link href={`/${org.slug}`}>
              <ItemContent>
                <ItemTitle>{org.name}</ItemTitle>
                <ItemDescription>
                  {org.tenant.name} &middot; {org.baseCurrency}
                </ItemDescription>
              </ItemContent>
            </Link>
          </Item>
        ))}
      </ItemGroup>
      {!orgs.length && (
        <EmptyState
          title="No active organizations are available."
          description="Ask your tenant administrator for access."
        />
      )}
      <div className="mt-8 space-y-6">
        {memberships
          .filter(
            (m) => m.role !== "MEMBER" && m.tenant._count.organizations === 0,
          )
          .map((m) => (
            <FormCard
              key={m.id}
              title={`Create the first organization for ${m.tenant.name}`}
            >
              <OrganizationForm
                tenantId={m.tenantId}
                countries={countries.map(({ id, name, code }) => ({
                  id,
                  name,
                  code,
                }))}
                states={states.map(({ id, name, countryId }) => ({
                  id,
                  name,
                  countryId,
                }))}
              />
            </FormCard>
          ))}
      </div>
    </main>
  );
}
