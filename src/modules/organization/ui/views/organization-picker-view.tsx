import { Building2, HardHat } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { EmptyState } from "@/components/shared/empty-state";
import { FormCard } from "@/components/shared/form-card";
import { listAccessibleOrgs, requireUser } from "@/core/context";
import { db } from "@/core/db";
import { OrganizationForm } from "../components/organization-form";
import {
  OrganizationList,
  type OrganizationListRow,
} from "../components/organization-list";
import { SignOutButton } from "../components/sign-out-button";

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

  const orgIds = orgs.map((org) => org.id);
  const [places, projectCounts] = await Promise.all([
    db.organization.findMany({
      where: { id: { in: orgIds } },
      select: {
        id: true,
        city: { select: { name: true } },
        state: { select: { name: true } },
      },
    }),
    db.project.groupBy({
      by: ["organizationId"],
      where: { organizationId: { in: orgIds }, status: "ACTIVE" },
      _count: { _all: true },
    }),
  ]);
  const placeById = new Map(places.map((place) => [place.id, place]));
  const activeById = new Map(
    projectCounts.map((row) => [row.organizationId, row._count._all]),
  );
  const rows: OrganizationListRow[] = orgs.map((org) => {
    const place = placeById.get(org.id);
    const location = [place?.city?.name, place?.state?.name]
      .filter(Boolean)
      .join(", ");
    return {
      id: org.id,
      name: org.name,
      slug: org.slug,
      tenantId: org.tenantId,
      tenantName: org.tenant.name,
      location: location || null,
      baseCurrency: org.baseCurrency,
      activeProjects: activeById.get(org.id) ?? 0,
    };
  });
  const tenantsToSetUp = memberships.filter(
    (m) => m.role !== "MEMBER" && m.tenant._count.organizations === 0,
  );
  const companyCount = new Set(rows.map((row) => row.tenantId)).size;
  const firstName = user.name.split(/\s+/)[0] || user.name;

  return (
    <div className="flex min-h-svh flex-1 flex-col">
      <header className="border-b bg-background/80">
        <div className="mx-auto flex h-14 w-full max-w-2xl items-center gap-3 px-6">
          <span className="flex size-7 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <HardHat className="size-4" />
          </span>
          <span className="text-sm font-semibold tracking-tight">
            Management
          </span>
          <div className="ml-auto flex items-center gap-1 text-sm">
            {user.role === "admin" && (
              <Link
                href="/admin"
                className="rounded-md px-2.5 py-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
              >
                Platform admin
              </Link>
            )}
            <SignOutButton />
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-2xl flex-1 px-6 pt-12 pb-16 sm:pt-16">
        <div className="mb-8 space-y-1.5">
          <h1 className="text-2xl font-semibold tracking-tight text-balance">
            {rows.length
              ? `Where are you working today, ${firstName}?`
              : `Welcome, ${firstName}`}
          </h1>
          <p className="text-sm text-muted-foreground">
            Signed in as {user.email}
            {rows.length > 1 &&
              `. You can open ${rows.length} organizations${
                companyCount > 1 ? ` across ${companyCount} companies` : ""
              }.`}
          </p>
        </div>

        {rows.length > 0 && <OrganizationList orgs={rows} />}

        {!rows.length && !tenantsToSetUp.length && (
          <div className="rounded-xl border border-dashed">
            <EmptyState
              icon={<Building2 />}
              title="You don't have access to any organizations yet"
              description="Ask an owner or admin of your company to add you to an organization, then refresh this page."
            />
          </div>
        )}

        {tenantsToSetUp.length > 0 && (
          <div className="mt-10 space-y-6">
            {tenantsToSetUp.map((m) => (
              <FormCard
                key={m.id}
                title={`Set up ${m.tenant.name}`}
                description={`${m.tenant.name} has no organizations yet. Create the first one to start tracking projects and costs.`}
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
        )}
      </main>
    </div>
  );
}
